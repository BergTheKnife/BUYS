import express, { type Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertUserSchema, loginUserSchema, insertInventarioSchema, insertVenditaSchema, insertSpesaSchema, updateProfileSchema, changePasswordSchema } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// Setup file upload
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file immagine sono permessi'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'davalb-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Serve uploaded files
  app.use('/uploads', express.static(uploadDir));

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Autenticazione richiesta" });
    }
    next();
  };

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUserByEmail = await storage.getUserByEmail(userData.email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email già in uso" });
      }

      const existingUserByUsername = await storage.getUserByUsername(userData.username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username già in uso" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Set session
      req.session.userId = user.id;

      res.json({ 
        user: { 
          id: user.id, 
          nome: user.nome, 
          cognome: user.cognome, 
          email: user.email, 
          username: user.username,
          createdAt: user.createdAt
        } 
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore durante la registrazione" });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { emailOrUsername, password } = loginUserSchema.parse(req.body);
      
      const user = await storage.getUserByEmailOrUsername(emailOrUsername);
      if (!user) {
        return res.status(401).json({ message: "Credenziali non valide" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Credenziali non valide" });
      }

      req.session.userId = user.id;

      res.json({ 
        user: { 
          id: user.id, 
          nome: user.nome, 
          cognome: user.cognome, 
          email: user.email, 
          username: user.username,
          createdAt: user.createdAt
        } 
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore durante il login" });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Errore durante il logout" });
      }
      res.json({ message: "Logout effettuato con successo" });
    });
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      res.json({ 
        user: { 
          id: user.id, 
          nome: user.nome, 
          cognome: user.cognome, 
          email: user.email, 
          username: user.username,
          createdAt: user.createdAt
        } 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore del server" });
    }
  });

  // Profile management routes
  app.put('/api/auth/profile', requireAuth, async (req, res) => {
    try {
      const profileData = updateProfileSchema.parse(req.body);
      
      // Check if new email is already in use by another user
      if (profileData.email) {
        const existingUser = await storage.getUserByEmail(profileData.email);
        if (existingUser && existingUser.id !== req.session.userId) {
          return res.status(400).json({ message: "Email già in uso" });
        }
      }

      const updatedUser = await storage.updateUser(req.session.userId!, profileData);
      if (!updatedUser) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      res.json({
        user: {
          id: updatedUser.id,
          nome: updatedUser.nome,
          cognome: updatedUser.cognome,
          email: updatedUser.email,
          username: updatedUser.username,
          createdAt: updatedUser.createdAt
        }
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore nell'aggiornamento del profilo" });
    }
  });

  app.put('/api/auth/password', requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: "Password attuale non corretta" });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(req.session.userId!, { password: hashedNewPassword });

      res.json({ message: "Password aggiornata con successo" });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore nel cambio password" });
    }
  });

  app.get('/api/export/data', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      const inventory = await storage.getInventoryByUserId(req.session.userId!);
      const sales = await storage.getSalesByUserId(req.session.userId!);
      const expenses = await storage.getExpensesByUserId(req.session.userId!);
      const stats = await storage.getUserStats(req.session.userId!);

      const exportData = {
        user: {
          nome: user?.nome,
          cognome: user?.cognome,
          email: user?.email,
          username: user?.username,
          createdAt: user?.createdAt
        },
        inventory,
        sales,
        expenses,
        stats,
        exportDate: new Date().toISOString()
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="davalb_export.json"');
      res.json(exportData);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'esportazione" });
    }
  });

  app.delete('/api/auth/account', requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteUser(req.session.userId!);
      if (!deleted) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });

      res.json({ message: "Account eliminato con successo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'eliminazione dell'account" });
    }
  });

  // Stats routes
  app.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const stats = await storage.getUserStats(req.session.userId!);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero delle statistiche" });
    }
  });

  // Inventory routes
  app.get('/api/inventario', requireAuth, async (req, res) => {
    try {
      const inventory = await storage.getInventoryByUserId(req.session.userId!);
      res.json(inventory);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero dell'inventario" });
    }
  });

  app.post('/api/inventario', requireAuth, upload.single('immagine'), async (req, res) => {
    try {
      const itemData = insertInventarioSchema.parse(req.body);
      
      let immagineUrl = null;
      if (req.file) {
        const filename = `${Date.now()}-${req.file.originalname}`;
        const filepath = path.join(uploadDir, filename);
        fs.renameSync(req.file.path, filepath);
        immagineUrl = `/uploads/${filename}`;
      }

      const item = await storage.createInventoryItem({
        ...itemData,
        userId: req.session.userId!,
        immagineUrl,
      });

      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore nell'aggiunta dell'articolo" });
    }
  });

  app.put('/api/inventario/:id', requireAuth, upload.single('immagine'), async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertInventarioSchema.partial().parse(req.body);
      
      if (req.file) {
        const filename = `${Date.now()}-${req.file.originalname}`;
        const filepath = path.join(uploadDir, filename);
        fs.renameSync(req.file.path, filepath);
        updates.immagineUrl = `/uploads/${filename}`;
      }

      const item = await storage.updateInventoryItem(id, req.session.userId!, updates);
      if (!item) {
        return res.status(404).json({ message: "Articolo non trovato" });
      }

      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore nell'aggiornamento dell'articolo" });
    }
  });

  app.delete('/api/inventario/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteInventoryItem(id, req.session.userId!);
      
      if (!deleted) {
        return res.status(404).json({ message: "Articolo non trovato" });
      }

      res.json({ message: "Articolo eliminato con successo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'eliminazione dell'articolo" });
    }
  });

  // Sales routes
  app.get('/api/vendite', requireAuth, async (req, res) => {
    try {
      const sales = await storage.getSalesByUserId(req.session.userId!);
      res.json(sales);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero delle vendite" });
    }
  });

  app.post('/api/vendite', requireAuth, async (req, res) => {
    try {
      const saleData = insertVenditaSchema.parse(req.body);
      
      // Get inventory item to calculate margin and update quantity
      const inventoryItem = await storage.getInventoryItem(saleData.inventarioId, req.session.userId!);
      if (!inventoryItem) {
        return res.status(404).json({ message: "Articolo non trovato nell'inventario" });
      }

      if (inventoryItem.quantita <= 0) {
        return res.status(400).json({ message: "Quantità insufficiente in magazzino" });
      }

      // Calculate margin
      const margine = Number(saleData.prezzoVendita) - Number(inventoryItem.costo);

      // Create sale
      const sale = await storage.createSale({
        ...saleData,
        userId: req.session.userId!,
        nomeArticolo: inventoryItem.nomeArticolo,
        taglia: inventoryItem.taglia,
        margine: margine.toString(),
      });

      // Update inventory quantity
      await storage.updateInventoryQuantity(saleData.inventarioId, inventoryItem.quantita - 1);

      res.json(sale);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore nella registrazione della vendita" });
    }
  });

  // Expenses routes
  app.get('/api/spese', requireAuth, async (req, res) => {
    try {
      const expenses = await storage.getExpensesByUserId(req.session.userId!);
      res.json(expenses);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero delle spese" });
    }
  });

  app.post('/api/spese', requireAuth, async (req, res) => {
    try {
      const expenseData = insertSpesaSchema.parse(req.body);
      
      const expense = await storage.createExpense({
        ...expenseData,
        userId: req.session.userId!,
      });

      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore nell'aggiunta della spesa" });
    }
  });

  app.put('/api/spese/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertSpesaSchema.partial().parse(req.body);
      
      const expense = await storage.updateExpense(id, req.session.userId!, updates);
      if (!expense) {
        return res.status(404).json({ message: "Spesa non trovata" });
      }

      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore nell'aggiornamento della spesa" });
    }
  });

  app.delete('/api/spese/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteExpense(id, req.session.userId!);
      
      if (!deleted) {
        return res.status(404).json({ message: "Spesa non trovata" });
      }

      res.json({ message: "Spesa eliminata con successo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'eliminazione della spesa" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
