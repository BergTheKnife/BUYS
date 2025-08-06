import express, { type Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import { 
  insertUserSchema, 
  loginUserSchema, 
  insertInventarioSchema, 
  insertVenditaSchema, 
  insertSpesaSchema, 
  updateProfileSchema, 
  changePasswordSchema, 
  updateUsernameSchema,
  insertActivitySchema,
  joinActivitySchema
} from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    activityId?: string;
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

  // Activity middleware - requires both auth and activity
  const requireActivity = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Autenticazione richiesta" });
    }
    if (!req.session.activityId) {
      return res.status(400).json({ message: "Nessuna attività selezionata" });
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

      // Set session
      req.session.userId = user.id;
      
      // Set last activity if user has one
      if (user.lastActivityId) {
        req.session.activityId = user.lastActivityId;
      }

      res.json({ 
        user: { 
          id: user.id, 
          nome: user.nome, 
          cognome: user.cognome, 
          email: user.email, 
          username: user.username,
          lastActivityId: user.lastActivityId,
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

      // Update session activity if user has one
      if (user.lastActivityId && !req.session.activityId) {
        req.session.activityId = user.lastActivityId;
      }

      res.json({ 
        user: { 
          id: user.id, 
          nome: user.nome, 
          cognome: user.cognome, 
          email: user.email, 
          username: user.username,
          lastActivityId: user.lastActivityId,
          currentActivityId: req.session.activityId,
          createdAt: user.createdAt
        } 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore del server" });
    }
  });

  // Check username availability
  app.get('/api/auth/check-username/:username', async (req, res) => {
    try {
      const { username } = req.params;
      
      if (!username || username.length < 3) {
        return res.json({ available: false, message: "Username deve essere di almeno 3 caratteri" });
      }

      const existingUser = await storage.getUserByUsername(username);
      
      res.json({ 
        available: !existingUser,
        message: existingUser ? "Username già in uso" : "Username disponibile"
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore del server" });
    }
  });

  // Update username
  app.put('/api/auth/username', requireAuth, async (req, res) => {
    try {
      const { username } = updateUsernameSchema.parse(req.body);
      
      // Check if username is already in use by another user
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser && existingUser.id !== req.session.userId) {
        return res.status(400).json({ message: "Username già in uso" });
      }

      const updatedUser = await storage.updateUser(req.session.userId!, { username });
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
      res.status(400).json({ message: error.message || "Errore nell'aggiornamento dell'username" });
    }
  });

  // Activity routes
  app.post('/api/activities', requireAuth, async (req, res) => {
    try {
      // Validate frontend data (expects 'password' field)
      const { nome, password } = req.body;
      
      if (!nome || !password) {
        return res.status(400).json({ message: "Nome attività e password sono richiesti" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "Password deve essere di almeno 6 caratteri" });
      }
      
      // Check if activity name already exists
      const existingActivity = await storage.getActivityByName(nome);
      if (existingActivity) {
        return res.status(400).json({ message: "Nome attività già esistente" });
      }

      // Hash activity password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const activity = await storage.createActivity({
        nome: nome,
        passwordHash: hashedPassword,
        proprietarioId: req.session.userId!,
      });

      // Set as current activity
      req.session.activityId = activity.id;
      
      // Update user's lastActivityId
      await storage.updateUser(req.session.userId!, { lastActivityId: activity.id });

      res.json({ 
        message: "Attività creata con successo",
        activity: {
          id: activity.id,
          nome: activity.nome,
          proprietarioId: activity.proprietarioId,
          createdAt: activity.createdAt
        }
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore durante la creazione dell'attività" });
    }
  });

  app.post('/api/activities/join', requireAuth, async (req, res) => {
    try {
      const joinData = joinActivitySchema.parse(req.body);
      
      // Find activity by name
      const activity = await storage.getActivityByName(joinData.nome);
      if (!activity) {
        return res.status(404).json({ message: "Attività non trovata o password errata" });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(joinData.password, activity.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Attività non trovata o password errata" });
      }

      // Join activity
      await storage.joinActivity(activity.id, req.session.userId!);

      // Set as current activity
      req.session.activityId = activity.id;
      
      // Update user's lastActivityId
      await storage.updateUser(req.session.userId!, { lastActivityId: activity.id });

      res.json({ 
        message: "Accesso all'attività effettuato con successo",
        activity: {
          id: activity.id,
          nome: activity.nome,
          proprietarioId: activity.proprietarioId,
          createdAt: activity.createdAt
        }
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore durante l'accesso all'attività" });
    }
  });

  app.get('/api/activities', requireAuth, async (req, res) => {
    try {
      const activities = await storage.getActivitiesByUserId(req.session.userId!);
      res.json(activities.map(activity => ({
        id: activity.id,
        nome: activity.nome,
        proprietarioId: activity.proprietarioId,
        createdAt: activity.createdAt
      })));
    } catch (error) {
      res.status(500).json({ message: "Errore del server" });
    }
  });

  app.post('/api/activities/switch/:activityId', requireAuth, async (req, res) => {
    try {
      const { activityId } = req.params;
      
      // Check if user is member of this activity
      const activities = await storage.getActivitiesByUserId(req.session.userId!);
      const activity = activities.find(a => a.id === activityId);
      
      if (!activity) {
        return res.status(403).json({ message: "Non sei membro di questa attività" });
      }

      // Switch to this activity
      req.session.activityId = activityId;

      res.json({ 
        message: "Attività cambiata con successo",
        activity: {
          id: activity.id,
          nome: activity.nome,
          proprietarioId: activity.proprietarioId,
          createdAt: activity.createdAt
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Errore del server" });
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

  app.get('/api/export/data', requireActivity, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      const inventory = await storage.getInventoryByActivity(req.session.activityId!);
      const sales = await storage.getSalesByActivity(req.session.activityId!);
      const expenses = await storage.getExpensesByActivity(req.session.activityId!);
      const stats = await storage.getActivityStats(req.session.activityId!);

      const exportData = {
        user: {
          nome: user?.nome,
          cognome: user?.cognome,
          email: user?.email,
          username: user?.username,
          createdAt: user?.createdAt
        },
        activityId: req.session.activityId!,
        inventory,
        sales,
        expenses,
        stats,
        exportDate: new Date().toISOString()
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="buys_activity_export.json"');
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
  app.get('/api/stats', requireActivity, async (req, res) => {
    try {
      const stats = await storage.getActivityStats(req.session.activityId!);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero delle statistiche" });
    }
  });

  // Recent activities route
  app.get('/api/recent-activities', requireActivity, async (req, res) => {
    try {
      const activities = await storage.getRecentActivitiesByActivity(req.session.activityId!);
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero delle attività recenti" });
    }
  });

  // Top selling items route
  app.get('/api/top-selling-items', requireActivity, async (req, res) => {
    try {
      const topItems = await storage.getTopSellingItemsByActivity(req.session.activityId!);
      res.json(topItems);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero degli articoli più venduti" });
    }
  });

  // Chart data route
  app.get('/api/chart-data', requireActivity, async (req, res) => {
    try {
      const chartData = await storage.getChartDataByActivity(req.session.activityId!);
      res.json(chartData);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero dei dati del grafico" });
    }
  });

  // Inventory routes
  app.get('/api/inventario', requireActivity, async (req, res) => {
    try {
      const inventory = await storage.getInventoryByActivity(req.session.activityId!);
      res.json(inventory);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero dell'inventario" });
    }
  });

  app.post('/api/inventario', requireActivity, upload.single('immagine'), async (req, res) => {
    try {
      // Convert form data types
      const formData = {
        nomeArticolo: req.body.nomeArticolo,
        taglia: req.body.taglia,
        costo: req.body.costo,
        quantita: parseInt(req.body.quantita)
      };
      
      const itemData = insertInventarioSchema.parse(formData);
      
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
        activityId: req.session.activityId!,
        immagineUrl: immagineUrl,
      } as any);

      // Create automatic expense for inventory purchase
      const totalCost = Number(itemData.costo) * itemData.quantita;
      await storage.createExpense({
        userId: req.session.userId!,
        activityId: req.session.activityId!,
        voce: `Acquisto inventario: ${itemData.nomeArticolo} - ${itemData.taglia}`,
        importo: totalCost.toString(),
        categoria: "Inventario",
        data: new Date(),
      });

      res.json(item);
    } catch (error: any) {
      console.error('Inventory creation error:', error);
      res.status(400).json({ message: error.message || "Errore nell'aggiunta dell'articolo" });
    }
  });

  app.put('/api/inventario/:id', requireActivity, upload.single('immagine'), async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertInventarioSchema.partial().parse(req.body);
      
      if (req.file) {
        const filename = `${Date.now()}-${req.file.originalname}`;
        const filepath = path.join(uploadDir, filename);
        fs.renameSync(req.file.path, filepath);
        (updates as any).immagineUrl = `/uploads/${filename}`;
      }

      const item = await storage.updateInventoryItem(id, req.session.activityId!, updates);
      if (!item) {
        return res.status(404).json({ message: "Articolo non trovato" });
      }

      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore nell'aggiornamento dell'articolo" });
    }
  });

  app.delete('/api/inventario/:id', requireActivity, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteInventoryItem(id, req.session.activityId!);
      
      if (!deleted) {
        return res.status(404).json({ message: "Articolo non trovato" });
      }

      res.json({ message: "Articolo eliminato con successo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'eliminazione dell'articolo" });
    }
  });

  app.post('/api/inventario/:id/restock', requireActivity, async (req, res) => {
    try {
      const { id } = req.params;
      const { quantita } = req.body;
      
      if (!quantita || quantita <= 0) {
        return res.status(400).json({ message: "Quantità non valida" });
      }

      const item = await storage.getInventoryItem(id, req.session.activityId!);
      if (!item) {
        return res.status(404).json({ message: "Articolo non trovato" });
      }

      // Update inventory quantity
      const newQuantity = item.quantita + parseInt(quantita);
      await storage.updateInventoryQuantity(id, newQuantity);

      // Create expense for restock
      const totalCost = Number(item.costo) * parseInt(quantita);
      await storage.createExpense({
        userId: req.session.userId!,
        activityId: req.session.activityId!,
        voce: `Rifornimento: ${item.nomeArticolo} - ${item.taglia} (${quantita} pz)`,
        importo: totalCost.toString(),
        categoria: "Inventario",
        data: new Date(),
      });

      // Get updated item
      const updatedItem = await storage.getInventoryItem(id, req.session.activityId!);
      res.json(updatedItem);
    } catch (error: any) {
      console.error('Restock error:', error);
      res.status(500).json({ message: error.message || "Errore nel rifornimento" });
    }
  });

  // Sales routes
  app.get('/api/vendite', requireActivity, async (req, res) => {
    try {
      const sales = await storage.getSalesByActivity(req.session.activityId!);
      res.json(sales);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero delle vendite" });
    }
  });

  app.post('/api/vendite', requireActivity, async (req, res) => {
    try {
      // Convert form data types
      const formData = {
        inventarioId: req.body.inventarioId,
        quantita: parseInt(req.body.quantita) || 1,
        prezzoVendita: req.body.prezzoVendita,
        incassatoDa: req.body.incassatoDa,
        incassatoSu: req.body.incassatoSu,
        data: new Date(req.body.data)
      };
      
      const saleData = insertVenditaSchema.parse(formData);
      
      // Get inventory item to calculate margin and update quantity
      const inventoryItem = await storage.getInventoryItem(saleData.inventarioId, req.session.activityId!);
      if (!inventoryItem) {
        return res.status(404).json({ message: "Articolo non trovato nell'inventario" });
      }

      const quantitaVenduta = saleData.quantita || 1;
      
      if (inventoryItem.quantita < quantitaVenduta) {
        return res.status(400).json({ message: "Quantità insufficiente in magazzino" });
      }

      // Calculate margin (per unit * quantity sold)
      const marginePerUnit = Number(saleData.prezzoVendita) - Number(inventoryItem.costo);
      const margineTotal = marginePerUnit * quantitaVenduta;

      // Create sale
      const sale = await storage.createSale({
        ...saleData,
        userId: req.session.userId!,
        activityId: req.session.activityId!,
        nomeArticolo: inventoryItem.nomeArticolo,
        taglia: inventoryItem.taglia,
        margine: margineTotal.toString(),
      });

      // Update inventory quantity
      await storage.updateInventoryQuantity(saleData.inventarioId, inventoryItem.quantita - quantitaVenduta);

      res.json(sale);
    } catch (error: any) {
      console.error('Sale creation error:', error);
      res.status(400).json({ message: error.message || "Errore nella registrazione della vendita" });
    }
  });

  // Expenses routes
  app.get('/api/spese', requireActivity, async (req, res) => {
    try {
      const expenses = await storage.getExpensesByActivity(req.session.activityId!);
      res.json(expenses);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero delle spese" });
    }
  });

  app.post('/api/spese', requireActivity, async (req, res) => {
    try {
      // Convert form data types
      const formData = {
        voce: req.body.voce,
        importo: req.body.importo,
        categoria: req.body.categoria,
        data: new Date(req.body.data)
      };
      
      const expenseData = insertSpesaSchema.parse(formData);
      
      const expense = await storage.createExpense({
        ...expenseData,
        userId: req.session.userId!,
        activityId: req.session.activityId!,
      });

      res.json(expense);
    } catch (error: any) {
      console.error('Expense creation error:', error);
      res.status(400).json({ message: error.message || "Errore nell'aggiunta della spesa" });
    }
  });

  app.put('/api/spese/:id', requireActivity, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertSpesaSchema.partial().parse(req.body);
      
      const expense = await storage.updateExpense(id, req.session.activityId!, updates);
      if (!expense) {
        return res.status(404).json({ message: "Spesa non trovata" });
      }

      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore nell'aggiornamento della spesa" });
    }
  });

  app.delete('/api/spese/:id', requireActivity, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteExpense(id, req.session.activityId!);
      
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
