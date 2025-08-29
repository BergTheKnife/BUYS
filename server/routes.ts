import express, { type Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";
import { db } from "./db";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { eq, sql, and } from "drizzle-orm";
import { activities, activityUsers, vendite, spese, inventario, users } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { DataProtectionService, dataProtectionMiddleware } from './dataProtection';
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
      maxAge: 24 * 60 * 60 * 1000, // 24 hours default (will be extended if rememberMe is true)
    },
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport Local Strategy
  passport.use(new LocalStrategy({
    usernameField: 'emailOrUsername',
    passwordField: 'password'
  }, async (emailOrUsername, password, done) => {
    try {
      const user = await storage.getUserByEmailOrUsername(emailOrUsername);
      if (!user) {
        return done(null, false, { message: 'Credenziali non valide' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return done(null, false, { message: 'Credenziali non valide' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));

  // Passport Google Strategy
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackURL: "/api/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists with this Google ID or email
      let user = await storage.getUserByEmail(profile.emails?.[0]?.value || "");
      
      if (!user) {
        // Create new user from Google profile
        const userData = {
          nome: profile.name?.givenName || "",
          cognome: profile.name?.familyName || "",
          email: profile.emails?.[0]?.value || "",
          username: profile.emails?.[0]?.value?.split('@')[0] || `user_${Date.now()}`,
          password: "" // No password for Google users
        };
        
        user = await storage.createUser(userData);
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));

  // Passport serialization
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Serve uploaded files  
  app.use('/uploads', express.static(uploadDir));
  
  // Add data protection middleware to log and protect all operations
  app.use(dataProtectionMiddleware);

  // Cleanup expired remember tokens every hour
  const startTokenCleanup = () => {
    const cleanup = async () => {
      try {
        await storage.cleanupExpiredRememberTokens();
        console.log('Cleaned up expired remember tokens');
      } catch (error) {
        console.error('Error cleaning up remember tokens:', error);
      }
    };
    
    // Run cleanup every hour (3600000 ms)
    setInterval(cleanup, 3600000);
    
    // Run initial cleanup after 5 minutes
    setTimeout(cleanup, 300000);
  };
  
  startTokenCleanup();

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
      console.log('DEBUG: No activityId in session for user:', req.session.userId);
      return res.status(400).json({ message: "Nessuna attività selezionata" });
    }
    console.log('DEBUG: Activity middleware passed for user:', req.session.userId, 'activity:', req.session.activityId);
    next();
  };

  // Google OAuth routes
  app.get('/api/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
      // Set session
      req.session.userId = (req.user as any).id;
      res.redirect('/dashboard'); // Redirect to dashboard or activity selection
    }
  );

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
      
      // Create user with email verification pending
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        isActive: 0, // Pending verification
      });

      // Generate verification token
      const { generateVerificationToken, getTokenExpiration, sendVerificationEmail } = await import('./emailService');
      const verificationToken = generateVerificationToken();
      
      // Create verification token in database
      await storage.createEmailVerificationToken({
        userId: user.id,
        token: verificationToken,
        expiresAt: getTokenExpiration(),
      });

      // Send verification email
      try {
        await sendVerificationEmail(user.email, user.nome, user.cognome, verificationToken);
        
        res.json({ 
          message: "Registrazione completata! Controlla la tua email per il link di verifica.",
          user: { 
            id: user.id, 
            nome: user.nome, 
            cognome: user.cognome, 
            email: user.email, 
            username: user.username,
            isActive: user.isActive,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt
          } 
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        
        // For development: provide fallback verification option
        if (process.env.NODE_ENV === 'development') {
          res.json({ 
            message: "Registrazione completata! ERRORE EMAIL: verifica manualmente con questo link",
            user: { 
              id: user.id, 
              nome: user.nome, 
              cognome: user.cognome, 
              email: user.email, 
              username: user.username,
              isActive: user.isActive,
              emailVerified: user.emailVerified,
              createdAt: user.createdAt
            },
            verificationUrl: `http://localhost:5000/api/auth/verify-email/${verificationToken}`,
            error: "Email service not configured properly"
          });
        } else {
          res.status(500).json({ 
            message: "Registrazione completata ma invio email fallito. Contatta il supporto."
          });
        }
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore durante la registrazione" });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { emailOrUsername, password, rememberMe } = req.body;
      
      const user = await storage.getUserByEmailOrUsername(emailOrUsername);
      if (!user) {
        return res.status(401).json({ message: "Credenziali non valide" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Credenziali non valide" });
      }

      // Check if email is verified
      if (user.isActive === 0) {
        return res.status(403).json({ 
          message: "Account non verificato. Controlla la tua email per il link di verifica.",
          needsVerification: true,
          userEmail: user.email
        });
      }

      // Set session
      req.session.userId = user.id;
      
      // Set session duration based on remember me checkbox
      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        
        // Create remember token for auto-login
        const rememberToken = randomBytes(64).toString('hex');
        const expiresAt = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days
        
        await storage.createRememberToken(user.id, rememberToken, expiresAt);
        
        // Set httpOnly cookie with remember token
        res.cookie('rememberToken', rememberToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
      } else {
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours if not remembered
      }
      
      // If user has a last activity, auto-restore it in session
      let restoredActivity = null;
      if (user.lastActivityId) {
        try {
          const activity = await storage.getActivityById(user.lastActivityId);
          if (activity) {
            req.session.activityId = user.lastActivityId;
            restoredActivity = activity;
            console.log('DEBUG: Restored last activity in session:', user.lastActivityId);
          }
        } catch (error) {
          console.log('Could not restore last activity:', error);
        }
      }
      
      // Save session and return response 
      req.session.save((err) => {
        if (err) {
          console.log('Session save error:', err);
          return res.status(500).json({ message: "Errore di sessione" });
        }
        
        res.json({ 
          user: { 
            id: user.id, 
            nome: user.nome, 
            cognome: user.cognome, 
            email: user.email, 
            username: user.username,
            createdAt: user.createdAt,
            profileImageUrl: user.profileImageUrl
          },
          hasActivity: !!restoredActivity,
          currentActivity: restoredActivity ? {
            id: restoredActivity.id,
            nome: restoredActivity.nome,
            proprietarioId: restoredActivity.proprietarioId
          } : null
        });
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Errore durante il login" });
    }
  });

  // Email verification route
  app.get('/api/auth/verify-email/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      // Clean up expired tokens first
      await storage.deleteExpiredTokens();
      
      // Find the verification token
      const verificationToken = await storage.getEmailVerificationToken(token);
      if (!verificationToken) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Verifica Email - BUYS</title>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .error { color: #e74c3c; }
              .btn { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2 class="error">Token di Verifica Non Valido</h2>
              <p>Il link di verifica è scaduto o non valido.</p>
              <p>Effettua una nuova registrazione per ricevere un nuovo link di verifica.</p>
              <a href="/" class="btn">Torna alla Home</a>
            </div>
          </body>
          </html>
        `);
      }

      // Check if token is expired
      if (new Date() > verificationToken.expiresAt) {
        await storage.deleteEmailVerificationToken(token);
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Verifica Email - BUYS</title>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .error { color: #e74c3c; }
              .btn { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2 class="error">Link di Verifica Scaduto</h2>
              <p>Il link di verifica è scaduto (24 ore).</p>
              <p>Effettua una nuova registrazione per ricevere un nuovo link di verifica.</p>
              <a href="/" class="btn">Torna alla Home</a>
            </div>
          </body>
          </html>
        `);
      }

      // Verify the user's email
      const verifiedUser = await storage.verifyUserEmail(verificationToken.userId);
      if (!verifiedUser) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Verifica Email - BUYS</title>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .error { color: #e74c3c; }
              .btn { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2 class="error">Utente Non Trovato</h2>
              <p>L'utente associato a questo token non esiste più.</p>
              <a href="/" class="btn">Torna alla Home</a>
            </div>
          </body>
          </html>
        `);
      }

      // Delete the used token
      await storage.deleteEmailVerificationToken(token);
      
      // Send welcome email
      try {
        const { sendWelcomeEmail } = await import('./emailService');
        await sendWelcomeEmail(verifiedUser.email, verifiedUser.nome, verifiedUser.cognome);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }

      // Redirect to app login with success message
      const successMessage = encodeURIComponent(`Registrazione completata con successo! Benvenuto ${verifiedUser.nome}, ora puoi accedere al tuo account.`);
      res.redirect(`/?verified=success&message=${successMessage}`);
      
    } catch (error: any) {
      console.error('Email verification error:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Errore Verifica - BUYS</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; }
            .btn { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="error">Errore di Sistema</h2>
            <p>Si è verificato un errore durante la verifica. Riprova più tardi.</p>
            <a href="/" class="btn">Torna alla Home</a>
          </div>
        </body>
        </html>
      `);
    }
  });

  // Password reset request endpoint
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { emailOrUsername } = req.body;
      
      if (!emailOrUsername) {
        return res.status(400).json({ message: "Email o username richiesto" });
      }

      // Find user by email or username
      const user = await storage.getUserByEmailOrUsername(emailOrUsername);
      
      // Always return success to prevent user enumeration
      if (!user) {
        return res.json({ 
          message: "Se l'account esiste, riceverai un'email con le istruzioni per il reset della password.",
          success: true
        });
      }

      // Check if user is verified
      if (user.isActive === 0) {
        return res.status(400).json({ 
          message: "L'account non è stato verificato. Completa prima la verifica email.",
          needsVerification: true
        });
      }

      // Delete any existing reset tokens for this user
      await storage.deletePasswordResetTokensByUserId(user.id);

      // Generate password reset token
      const { generatePasswordResetToken, getTokenExpiration, sendPasswordResetEmail } = await import('./emailService');
      const resetToken = generatePasswordResetToken();
      
      // Store reset token (reuse email verification tokens table structure)
      await storage.createPasswordResetToken({
        userId: user.id,
        token: resetToken,
        expiresAt: getTokenExpiration(), // 24 hours
      });

      // Send password reset email
      try {
        await sendPasswordResetEmail(user.email, user.nome, user.cognome, resetToken);
        
        return res.json({ 
          message: "Se l'account esiste, riceverai un'email con le istruzioni per il reset della password.",
          success: true
        });
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        return res.status(500).json({ 
          message: "Errore nell'invio dell'email. Riprova più tardi.",
          success: false
        });
      }
      
    } catch (error: any) {
      console.error('Password reset request error:', error);
      res.status(500).json({ 
        message: "Errore nella richiesta di reset password. Riprova più tardi.",
        success: false
      });
    }
  });

  // Password reset confirmation endpoint
  app.post('/api/auth/reset-password/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ 
          message: "La nuova password deve essere di almeno 6 caratteri" 
        });
      }

      // Clean up expired tokens first
      await storage.deleteExpiredPasswordResetTokens();
      
      // Find the reset token
      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ 
          message: "Token di reset non valido o scaduto" 
        });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        await storage.deletePasswordResetToken(token);
        return res.status(400).json({ 
          message: "Il link di reset password è scaduto. Richiedi un nuovo reset." 
        });
      }

      // Get user
      const user = await storage.getUser(resetToken.userId);
      if (!user) {
        return res.status(404).json({ 
          message: "Utente non trovato" 
        });
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { password: hashedPassword });

      // Delete the used token
      await storage.deletePasswordResetToken(token);
      
      // Send confirmation email
      try {
        const { sendPasswordChangeConfirmationEmail } = await import('./emailService');
        await sendPasswordChangeConfirmationEmail(user.email, user.nome, user.cognome);
      } catch (emailError) {
        console.error('Failed to send password change confirmation:', emailError);
      }

      res.json({ 
        message: "Password aggiornata con successo. Ora puoi accedere con la nuova password.",
        success: true
      });
      
    } catch (error: any) {
      console.error('Password reset error:', error);
      res.status(500).json({ 
        message: "Errore nell'aggiornamento della password. Riprova più tardi.",
        success: false
      });
    }
  });

  // Resend verification email endpoint
  app.post('/api/auth/resend-verification', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email richiesta" });
      }

      // Check if user exists by email or username
      let user = await storage.getUserByEmail(email);
      if (!user) {
        user = await storage.getUserByUsername(email);
      }
      
      if (!user) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      // Check if user is already verified
      if (user.emailVerified) {
        return res.status(400).json({ message: "Account già verificato" });
      }

      // Delete any existing verification tokens for this user
      await storage.deleteEmailVerificationTokensByUserId(user.id);

      // Generate new verification token
      const { generateVerificationToken, getTokenExpiration } = await import('./emailService');
      const verificationToken = generateVerificationToken();
      
      // Store new token
      await storage.createEmailVerificationToken({
        userId: user.id,
        token: verificationToken,
        expiresAt: getTokenExpiration(),
      });

      // Send verification email
      const { sendVerificationEmail } = await import('./emailService');
      await sendVerificationEmail(user.email, user.nome, user.cognome, verificationToken);
      
      res.json({ 
        message: "Email di verifica inviata nuovamente. Controlla la tua casella di posta.",
        success: true
      });
      
    } catch (error: any) {
      console.error('Resend verification email error:', error);
      res.status(500).json({ 
        message: "Errore nell'invio dell'email di verifica. Riprova più tardi.",
        success: false
      });
    }
  });

  // Debug endpoint to test email configuration
  app.post('/api/debug/test-email', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ message: 'Not found' });
    }
    
    try {
      const { testEmailConnection, sendVerificationEmail, generateVerificationToken } = await import('./emailService');
      
      // Test SMTP connection first
      const isConnected = await testEmailConnection();
      if (!isConnected) {
        return res.status(500).json({ 
          success: false, 
          message: 'SMTP connection failed',
          details: 'Check SMTP credentials and server settings'
        });
      }

      // If email is provided, send a test email
      const { email } = req.body;
      if (email) {
        const token = generateVerificationToken();
        await sendVerificationEmail(email, 'Test', 'User', token);
        return res.json({ 
          success: true, 
          message: `Test email sent to ${email}`,
          token: token
        });
      }

      return res.json({ 
        success: true, 
        message: 'SMTP connection is working',
        connectionTest: true
      });
    } catch (error: any) {
      console.error('Test email error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Email test failed',
        error: error.message 
      });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      // Clear remember token if exists
      const rememberToken = req.cookies.rememberToken;
      if (rememberToken) {
        await storage.deleteRememberToken(rememberToken);
        res.clearCookie('rememberToken');
      }
      
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: "Errore durante il logout" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logout effettuato con successo" });
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: "Errore durante il logout" });
    }
  });

  // Auto-login with remember token
  app.post('/api/auth/auto-login', async (req, res) => {
    try {
      const rememberToken = req.cookies.rememberToken;
      
      if (!rememberToken) {
        return res.status(401).json({ message: "Nessun token di ricordo trovato" });
      }

      const tokenData = await storage.getRememberToken(rememberToken);
      
      if (!tokenData) {
        res.clearCookie('rememberToken');
        return res.status(401).json({ message: "Token di ricordo non valido" });
      }

      // Check if token has expired
      if (new Date() > tokenData.expiresAt) {
        await storage.deleteRememberToken(rememberToken);
        res.clearCookie('rememberToken');
        return res.status(401).json({ message: "Token di ricordo scaduto" });
      }

      // Get user data
      const user = await storage.getUser(tokenData.userId);
      if (!user || user.isActive === 0) {
        await storage.deleteRememberToken(rememberToken);
        res.clearCookie('rememberToken');
        return res.status(401).json({ message: "Utente non valido" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      
      // Restore last activity if available
      let restoredActivity = null;
      if (user.lastActivityId) {
        try {
          const activity = await storage.getActivityById(user.lastActivityId);
          if (activity) {
            req.session.activityId = user.lastActivityId;
            restoredActivity = activity;
          }
        } catch (error) {
          console.log('Could not restore last activity:', error);
        }
      }
      
      req.session.save((err) => {
        if (err) {
          console.log('Session save error:', err);
          return res.status(500).json({ message: "Errore di sessione" });
        }
        
        res.json({ 
          user: { 
            id: user.id, 
            nome: user.nome, 
            cognome: user.cognome, 
            email: user.email, 
            username: user.username,
            createdAt: user.createdAt,
            profileImageUrl: user.profileImageUrl
          },
          hasActivity: !!restoredActivity,
          currentActivity: restoredActivity ? {
            id: restoredActivity.id,
            nome: restoredActivity.nome,
            proprietarioId: restoredActivity.proprietarioId
          } : null
        });
      });
    } catch (error: any) {
      console.error('Auto-login error:', error);
      res.status(500).json({ message: "Errore durante l'auto-login" });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      // Auto-restore last activity if no current activity in session but user has lastActivityId
      if (!req.session.activityId && user.lastActivityId) {
        try {
          // Check if user still has access to this activity
          const userActivities = await storage.getActivitiesByUserId(user.id);
          const hasAccessToLastActivity = userActivities.some(activity => activity.id === user.lastActivityId);
          
          if (hasAccessToLastActivity) {
            req.session.activityId = user.lastActivityId;
            console.log('DEBUG: Auto-restored last activity in /me endpoint:', user.lastActivityId);
          } else {
            // Clear invalid lastActivityId
            await storage.updateUser(user.id, { lastActivityId: null });
            console.log('DEBUG: Cleared invalid lastActivityId for user:', user.id);
          }
        } catch (error) {
          console.log('Error auto-restoring activity:', error);
        }
      }

      // Get current activity details if user has one selected
      let currentActivity = null;
      if (req.session.activityId) {
        try {
          currentActivity = await storage.getActivityById(req.session.activityId);
        } catch (error) {
          // Activity might not exist anymore, clear from session
          req.session.activityId = undefined;
        }
      }

      res.json({ 
        user: { 
          id: user.id, 
          nome: user.nome, 
          cognome: user.cognome, 
          email: user.email, 
          username: user.username,
          lastActivityId: user.lastActivityId,
          activityId: req.session.activityId,
          createdAt: user.createdAt,
          profileImageUrl: user.profileImageUrl
        },
        currentActivity: currentActivity ? {
          id: currentActivity.id,
          nome: currentActivity.nome,
          proprietarioId: currentActivity.proprietarioId,
          createdAt: currentActivity.createdAt
        } : null
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

  // Activity management routes
  app.put('/api/activities/:id/name', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { nome } = req.body;
      
      if (!nome || nome.trim().length === 0) {
        return res.status(400).json({ message: "Nome attività richiesto" });
      }

      // Check if activity exists and user has permission
      const activity = await storage.getActivityById(id);
      if (!activity) {
        return res.status(404).json({ message: "Attività non trovata" });
      }

      // Check if user has permission (owner or member)
      // For now, allow only owner to change name
      if (activity.proprietarioId !== req.session.userId) {
        return res.status(403).json({ message: "Non hai i permessi per modificare questa attività" });
      }

      // Check if name is already taken by another activity
      const existingActivity = await storage.getActivityByName(nome);
      if (existingActivity && existingActivity.id !== id) {
        return res.status(400).json({ message: "Nome attività già esistente" });
      }

      // Update activity name
      const [updatedActivity] = await db
        .update(activities)
        .set({ nome: nome.trim(), updatedAt: new Date() })
        .where(eq(activities.id, id))
        .returning();

      res.json({ 
        message: "Nome attività aggiornato con successo",
        activity: {
          id: updatedActivity.id,
          nome: updatedActivity.nome,
          proprietarioId: updatedActivity.proprietarioId,
          createdAt: updatedActivity.createdAt
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'aggiornamento del nome" });
    }
  });

  app.put('/api/activities/:id/password', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Password attuale e nuova password richieste" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "La nuova password deve essere di almeno 6 caratteri" });
      }

      // Check if activity exists and user has permission
      const activity = await storage.getActivityById(id);
      if (!activity) {
        return res.status(404).json({ message: "Attività non trovata" });
      }

      // Check if user has permission (owner or member)
      if (activity.proprietarioId !== req.session.userId) {
        return res.status(403).json({ message: "Non hai i permessi per modificare questa attività" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, activity.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Password attuale non corretta" });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update activity password
      await db
        .update(activities)
        .set({ passwordHash: hashedNewPassword, updatedAt: new Date() })
        .where(eq(activities.id, id));

      res.json({ message: "Password attività aggiornata con successo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'aggiornamento della password" });
    }
  });

  // Delete activity route
  app.delete('/api/activities/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password richiesta per eliminare l'attività" });
      }

      // Check if activity exists and user has permission
      const activity = await storage.getActivityById(id);
      if (!activity) {
        return res.status(404).json({ message: "Attività non trovata" });
      }

      // Check if user is the owner
      if (activity.proprietarioId !== req.session.userId) {
        return res.status(403).json({ message: "Solo il proprietario può eliminare l'attività" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, activity.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Password non corretta" });
      }

      // Delete all related data first (cascade delete)
      // Delete user activity relations
      await db.delete(activityUsers).where(eq(activityUsers.activityId, id));
      
      // Delete sales
      await db.delete(vendite).where(eq(vendite.activityId, id));
      
      // Delete expenses  
      await db.delete(spese).where(eq(spese.activityId, id));
      
      // Delete inventory
      await db.delete(inventario).where(eq(inventario.activityId, id));

      // Finally delete the activity
      await db.delete(activities).where(eq(activities.id, id));

      // Clear session if this was the current activity
      if (req.session.activityId === id) {
        req.session.activityId = undefined;
        
        // Update user's lastActivityId to null if it was this activity
        await storage.updateUser(req.session.userId!, { lastActivityId: null });
      }

      res.json({ message: "Attività eliminata con successo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'eliminazione dell'attività" });
    }
  });

  // Leave activity endpoint
  app.post('/api/activities/:activityId/leave', requireActivity, async (req, res) => {
    try {
      const { activityId } = req.params;
      const userId = req.session.userId!;
      
      // Check if this is current activity
      if (req.session.activityId !== activityId) {
        return res.status(400).json({ message: "Devi essere nell'attività per abbandonarla" });
      }
      
      // Check if user is the owner
      const activity = await storage.getActivityById(activityId);
      if (activity?.proprietarioId === userId) {
        return res.status(400).json({ 
          message: "Non puoi abbandonare un'attività che hai creato. Puoi solo eliminarla." 
        });
      }
      
      // Leave activity
      await storage.leaveActivity(activityId, userId);
      
      // Clear session activity
      delete req.session.activityId;
      
      res.json({ message: "Hai abbandonato l'attività con successo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'abbandono dell'attività" });
    }
  });

  // Admin routes - only for development
  const isAdmin = (req: any, res: any, next: any) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).json({ message: "Not found" });
    }
    // Admin routes don't require user authentication, only admin session
    if (!(req.session as any).adminAuthenticated) {
      return res.status(401).json({ message: "Autenticazione admin richiesta" });
    }
    next();
  };

  app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithActivities = await Promise.all(
        users.map(async (user) => {
          const activities = await storage.getUserActivities(user.id);
          return {
            ...user,
            password: undefined, // Don't expose passwords
            activities: activities
          };
        })
      );
      res.json(usersWithActivities);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore del server" });
    }
  });

  app.get('/api/admin/activities', isAdmin, async (req, res) => {
    try {
      const activities = await storage.getAllActivities();
      const activitiesWithMembers = await Promise.all(
        activities.map(async (activity) => {
          const members = await storage.getActivityMembers(activity.id);
          return {
            ...activity,
            members: members
          };
        })
      );
      res.json(activitiesWithMembers);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore del server" });
    }
  });

  app.delete('/api/admin/activities/:id', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // CRITICAL DATA PROTECTION: Prevent accidental deletion of activities with data
      const inventoryCount = await db.select({ count: sql`count(*)` }).from(inventario).where(eq(inventario.activityId, id));
      const salesCount = await db.select({ count: sql`count(*)` }).from(vendite).where(eq(vendite.activityId, id));
      const expensesCount = await db.select({ count: sql`count(*)` }).from(spese).where(eq(spese.activityId, id));
      
      const totalRecords = Number(inventoryCount[0]?.count || 0) + Number(salesCount[0]?.count || 0) + Number(expensesCount[0]?.count || 0);
      
      if (totalRecords > 0) {
        return res.status(403).json({ 
          message: `PROTEZIONE DATI: Impossibile eliminare l'attività. Contiene ${totalRecords} record di dati (inventario, vendite, spese). Solo il proprietario può eliminarla dall'interfaccia utente.` 
        });
      }
      
      // Only delete if activity is completely empty
      await db.delete(activities).where(eq(activities.id, id));
      
      res.json({ message: "Attività eliminata con successo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'eliminazione dell'attività" });
    }
  });

  app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // CRITICAL DATA PROTECTION: Check for user activities with data
      const userActivities = await storage.getActivitiesByUserId(id);
      let totalDataRecords = 0;
      
      for (const activity of userActivities) {
        const inventoryCount = await db.select({ count: sql`count(*)` }).from(inventario).where(eq(inventario.activityId, activity.id));
        const salesCount = await db.select({ count: sql`count(*)` }).from(vendite).where(eq(vendite.activityId, activity.id));
        const expensesCount = await db.select({ count: sql`count(*)` }).from(spese).where(eq(spese.activityId, activity.id));
        
        totalDataRecords += Number(inventoryCount[0]?.count || 0) + Number(salesCount[0]?.count || 0) + Number(expensesCount[0]?.count || 0);
      }
      
      if (totalDataRecords > 0) {
        return res.status(403).json({ 
          message: `PROTEZIONE DATI: Impossibile eliminare l'utente. Le sue attività contengono ${totalDataRecords} record di dati. L'utente deve prima eliminare le sue attività con dati dall'interfaccia utente.` 
        });
      }
      
      // Only delete if user has no activities with data
      await db.delete(users).where(eq(users.id, id));
      
      res.json({ message: "Utente eliminato con successo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'eliminazione dell'utente" });
    }
  });

  // Switch activity
  app.put('/api/activities/switch', requireAuth, async (req, res) => {
    try {
      const { activityId } = req.body;
      const userId = req.session.userId!;

      // Verify user has access to this activity
      const userActivities = await storage.getActivitiesByUserId(userId);
      const hasAccess = userActivities.some(activity => activity.id === activityId);

      if (!hasAccess) {
        return res.status(403).json({ message: "Non hai accesso a questa attività" });
      }

      // Update session and user's last activity
      req.session.activityId = activityId;
      await storage.updateLastActivity(userId, activityId);

      // Get current activity details
      const currentActivity = await storage.getActivityById(activityId);
      
      if (!currentActivity) {
        return res.status(404).json({ message: "Attività non trovata" });
      }

      res.json({ 
        message: "Attività cambiata con successo",
        currentActivity: {
          id: currentActivity.id,
          nome: currentActivity.nome,
          proprietarioId: currentActivity.proprietarioId,
          createdAt: currentActivity.createdAt
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel cambio attività" });
    }
  });

  // Get activity members (only for activity owner)
  app.get('/api/activity-members/:activityId', requireAuth, requireActivity, async (req, res) => {
    try {
      const { activityId } = req.params;
      
      // Check if user is the owner
      const activity = await storage.getActivityById(activityId);
      if (!activity || activity.proprietarioId !== req.session.userId) {
        return res.status(403).json({ message: "Solo il proprietario può visualizzare i membri" });
      }

      // Get all members of the activity
      const members = await db.select({
        userId: users.id,
        nome: users.nome,
        cognome: users.cognome,
        email: users.email,
        username: users.username,
        joinedAt: activityUsers.joinedAt,
        isOwner: sql<boolean>`${users.id} = ${activity.proprietarioId}`
      })
      .from(activityUsers)
      .innerJoin(users, eq(activityUsers.userId, users.id))
      .where(eq(activityUsers.activityId, activityId));

      res.json(members);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero dei membri" });
    }
  });

  // Add member to activity (only for activity owner)
  app.post('/api/activities/:activityId/members', requireAuth, requireActivity, async (req, res) => {
    try {
      const { activityId } = req.params;
      const { emailOrUsername } = req.body;
      
      // Check if user is the owner
      const activity = await storage.getActivityById(activityId);
      if (!activity || activity.proprietarioId !== req.session.userId) {
        return res.status(403).json({ message: "Solo il proprietario può aggiungere membri" });
      }

      // Find user by email or username
      let targetUser;
      if (emailOrUsername.includes('@')) {
        // Search by email
        targetUser = await storage.getUserByEmail(emailOrUsername);
      } else {
        // Search by username
        targetUser = await storage.getUserByUsername(emailOrUsername);
      }

      if (!targetUser) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      // Check if user is already a member
      const existingMembership = await db.select()
        .from(activityUsers)
        .where(
          and(
            eq(activityUsers.userId, targetUser.id),
            eq(activityUsers.activityId, activityId)
          )
        );

      if (existingMembership.length > 0) {
        return res.status(400).json({ message: "L'utente è già membro di questa attività" });
      }

      // Add user to activity
      await storage.addUserToActivity(targetUser.id, activityId);

      res.json({ 
        message: "Membro aggiunto con successo",
        member: {
          userId: targetUser.id,
          nome: targetUser.nome,
          cognome: targetUser.cognome,
          email: targetUser.email,
          username: targetUser.username
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'aggiunta del membro" });
    }
  });

  // Remove member from activity (only for activity owner)
  app.delete('/api/activities/:activityId/members/:userId', requireAuth, requireActivity, async (req, res) => {
    try {
      const { activityId, userId } = req.params;
      
      // Check if user is the owner
      const activity = await storage.getActivityById(activityId);
      if (!activity || activity.proprietarioId !== req.session.userId) {
        return res.status(403).json({ message: "Solo il proprietario può rimuovere membri" });
      }

      // Cannot remove the owner
      if (userId === activity.proprietarioId) {
        return res.status(400).json({ message: "Il proprietario non può essere rimosso dall'attività" });
      }

      // Remove user from activity
      await storage.removeUserFromActivity(userId, activityId);

      res.json({ message: "Membro rimosso con successo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nella rimozione del membro" });
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
      // Validate frontend data (expects 'password' field)
      const { nome, password } = req.body;
      
      if (!nome || !password) {
        return res.status(400).json({ message: "Nome attività e password sono richiesti" });
      }
      
      // Find activity by name
      const activity = await storage.getActivityByName(nome);
      if (!activity) {
        return res.status(404).json({ message: "Attività non trovata o password errata" });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, activity.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Attività non trovata o password errata" });
      }

      // Join activity
      await storage.joinActivity(activity.id, req.session.userId!);

      // Set as current activity
      req.session.activityId = activity.id;

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
      const userId = req.session.userId!;
      
      // SECURITY: Validate this is a user-initiated deletion
      DataProtectionService.validateDeletionRequest('user', 'user', userId);
      
      // Check for protected data
      const protection = await DataProtectionService.hasProtectedData(userId);
      if (protection.hasData) {
        return res.status(409).json({ 
          message: `Impossibile eliminare account con dati esistenti: ${protection.protectedItems.join(', ')}`,
          protectedData: protection.protectedItems,
          counts: protection.counts
        });
      }
      
      // Create backup before deletion
      await DataProtectionService.createBackup(userId, 'USER_INITIATED_ACCOUNT_DELETION');
      
      await storage.deleteUser(userId);

      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });

      DataProtectionService.logDataOperation('USER_ACCOUNT_DELETED', userId, { timestamp: new Date().toISOString() });
      res.json({ message: "Account eliminato con successo" });
    } catch (error: any) {
      DataProtectionService.logDataOperation('USER_ACCOUNT_DELETION_FAILED', req.session.userId!, { error: error.message });
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
  // Activity history endpoint with filters
  app.get('/api/activity-history', requireActivity, async (req, res) => {
    try {
      const activityId = req.session.activityId;
      const { period = 'all', month, year } = req.query;
      
      let dateFilter = sql`1=1`; // No filter by default
      
      // Apply date filters
      if (period === 'today') {
        dateFilter = sql`DATE(created_at) = CURRENT_DATE`;
      } else if (period === 'month' && month && year) {
        dateFilter = sql`EXTRACT(MONTH FROM created_at) = ${month} AND EXTRACT(YEAR FROM created_at) = ${year}`;
      } else if (period === 'year' && year) {
        dateFilter = sql`EXTRACT(YEAR FROM created_at) = ${year}`;
      }
      
      // Get inventory additions
      const inventoryHistory = await db.select({
        id: inventario.id,
        type: sql`'inventory'`,
        description: sql`'Aggiunto articolo: ' || ${inventario.nomeArticolo} || ' - ' || ${inventario.taglia}`,
        amount: inventario.costo,
        data: inventario.createdAt,
        details: sql`json_build_object('nome', ${inventario.nomeArticolo}, 'taglia', ${inventario.taglia}, 'quantita', ${inventario.quantita})`
      }).from(inventario)
        .where(sql`${eq(inventario.activityId, activityId!)} AND ${dateFilter}`);
      
      // Get sales
      const salesHistory = await db.select({
        id: vendite.id,
        type: sql`'sale'`,
        description: sql`'Vendita: ' || ${vendite.nomeArticolo} || ' - ' || ${vendite.taglia}`,
        amount: vendite.prezzoVendita,
        data: vendite.createdAt,
        details: sql`json_build_object('nome', ${vendite.nomeArticolo}, 'taglia', ${vendite.taglia}, 'quantita', ${vendite.quantita}, 'incassato_da', ${vendite.incassatoDa})`
      }).from(vendite)
        .where(sql`${eq(vendite.activityId, activityId!)} AND ${dateFilter}`);
      
      // Get expenses
      const expensesHistory = await db.select({
        id: spese.id,
        type: sql`'expense'`,
        description: spese.voce,
        amount: spese.importo,
        data: spese.createdAt,
        details: sql`json_build_object('categoria', ${spese.categoria})`
      }).from(spese)
        .where(sql`${eq(spese.activityId, activityId!)} AND ${dateFilter}`);
      
      // Combine and sort by date (newest first)
      const allHistory = [...inventoryHistory, ...salesHistory, ...expensesHistory]
        .sort((a, b) => new Date(b.data || new Date()).getTime() - new Date(a.data || new Date()).getTime());
        
      res.json(allHistory);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore del server" });
    }
  });

  app.get('/api/recent-activities', requireActivity, async (req, res) => {
    try {
      // Return empty array for now - this endpoint can be implemented later if needed
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero delle attività recenti" });
    }
  });

  // Top selling items route
  // Get activity members for sales form dropdown
  app.get('/api/activity-members', requireActivity, async (req, res) => {
    try {
      const activityId = req.session.activityId;
      
      const members = await db.select({
        id: users.id,
        nome: users.nome,
        cognome: users.cognome,
        displayName: sql`${users.nome} || ' ' || ${users.cognome}`
      }).from(activityUsers)
        .innerJoin(users, eq(activityUsers.userId, users.id))
        .where(eq(activityUsers.activityId, activityId!));
      
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero dei membri" });
    }
  });

  app.get('/api/top-selling-items', requireActivity, async (req, res) => {
    try {
      const topItems = await storage.getTopSellingItemsByActivity(req.session.activityId!);
      res.json(topItems);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero degli articoli più venduti" });
    }
  });

  // Profile image upload endpoints
  app.post('/api/profile/upload-url', requireAuth, async (req, res) => {
    try {
      console.log('🚀 Profile upload URL endpoint called');
      
      // Check if object storage is available
      if (!process.env.PRIVATE_OBJECT_DIR) {
        console.log('❌ PRIVATE_OBJECT_DIR not configured');
        return res.status(500).json({ 
          message: "Object storage non configurato. Contatta l'amministratore." 
        });
      }

      console.log('✅ Object storage configured:', process.env.PRIVATE_OBJECT_DIR);
      
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getProfileImageUploadURL();
      
      console.log('✅ Upload URL generated:', uploadURL);
      res.json({ uploadURL });
    } catch (error: any) {
      console.error('❌ Profile upload URL error:', error);
      res.status(500).json({ message: error.message || "Errore nella generazione URL upload" });
    }
  });

  app.post('/api/profile/update-image', requireAuth, async (req, res) => {
    try {
      const { imageUrl } = req.body;
      const userId = req.session.userId;

      if (!imageUrl) {
        return res.status(400).json({ message: "URL immagine richiesta" });
      }

      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(imageUrl);

      // Update user profile image URL
      const updatedUser = await storage.updateUserProfileImage(userId!, normalizedPath);

      res.json({
        message: "Immagine profilo aggiornata con successo",
        profileImageUrl: normalizedPath
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'aggiornamento immagine profilo" });
    }
  });

  // Profile update endpoint
  app.post('/api/profile/update', requireAuth, async (req, res) => {
    try {
      const { nome, cognome, email } = req.body;
      const userId = req.session.userId;

      if (!nome || !cognome || !email) {
        return res.status(400).json({ message: "Tutti i campi sono richiesti" });
      }

      const updatedUser = await storage.updateUserProfile(userId!, { nome, cognome, email });

      res.json({
        message: "Profilo aggiornato con successo",
        user: updatedUser
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'aggiornamento profilo" });
    }
  });

  // Alias for profile delete for compatibility
  app.delete('/api/profile/delete-account', requireAuth, async (req, res) => {
    try {
      await storage.deleteUser(req.session.userId!);

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

  // Serve profile images
  app.get('/objects/:objectPath(*)', async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "File not found" });
      }
      return res.status(500).json({ error: "Internal server error" });
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

  // Export inventory to Excel
  app.get('/api/export/inventory/excel', requireActivity, async (req, res) => {
    try {
      const xlsx = await import('xlsx');
      const activityId = req.session.activityId!;
      
      // Get inventory and sales data
      const inventory = await storage.getInventoryByActivity(activityId);
      const sales = await storage.getSalesByActivity(activityId);
      
      // Calculate sold quantities for each inventory item
      const soldQuantities = new Map<string, number>();
      
      sales.forEach(sale => {
        const key = `${sale.nomeArticolo}-${sale.taglia}`;
        const currentSold = soldQuantities.get(key) || 0;
        soldQuantities.set(key, currentSold + sale.quantita);
      });
      
      // Prepare data for Excel export
      const excelData = inventory.map(item => {
        const key = `${item.nomeArticolo}-${item.taglia}`;
        const quantitaVenduta = soldQuantities.get(key) || 0;
        const valoreTotale = Number(item.costo) * item.quantita;
        
        return {
          'Nome Articolo': item.nomeArticolo,
          'Taglia': item.taglia,
          'Costo (€)': Number(item.costo).toFixed(2),
          'Quantità Disponibile': item.quantita,
          'Quantità Venduta': quantitaVenduta,
          'Valore Totale (€)': valoreTotale.toFixed(2),
          'Data Creazione': new Date(item.createdAt || '').toLocaleDateString('it-IT')
        };
      });
      
      // Create workbook and worksheet
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(excelData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 20 }, // Nome Articolo
        { wch: 10 }, // Taglia
        { wch: 12 }, // Costo
        { wch: 18 }, // Quantità Disponibile
        { wch: 16 }, // Quantità Venduta
        { wch: 16 }, // Valore Totale
        { wch: 15 }  // Data Creazione
      ];
      
      // Add worksheet to workbook
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Inventario');
      
      // Generate Excel file buffer
      const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set response headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="inventario_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.setHeader('Content-Length', excelBuffer.length);
      
      // Send the Excel file
      res.send(excelBuffer);
    } catch (error: any) {
      console.error('Excel export error:', error);
      res.status(500).json({ message: error.message || "Errore nell'esportazione Excel" });
    }
  });

  // Get activity members for dropdown selections
  app.get("/api/activity-members", requireActivity, async (req, res) => {
    try {
      const activityId = req.session.activityId;
      const members = await storage.getActivityMembers(activityId!);
      res.json(members);
    } catch (error: any) {
      console.error('Error fetching activity members:', error);
      res.status(500).json({ message: error.message || "Errore nel recupero dei membri dell'attività" });
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
        try {
          // Use Object Storage for inventory images
          const objectStorageService = new ObjectStorageService();
          const uploadURL = await objectStorageService.getInventoryImageUploadURL();
          
          // Upload file to Object Storage
          const fileBuffer = fs.readFileSync(req.file.path);
          const uploadResponse = await fetch(uploadURL, {
            method: 'PUT',
            body: fileBuffer,
            headers: {
              'Content-Type': req.file.mimetype,
            }
          });

          if (uploadResponse.ok) {
            // Normalize the URL for our system
            immagineUrl = objectStorageService.normalizeObjectEntityPath(uploadURL.split('?')[0]);
          } else {
            console.error('Failed to upload to Object Storage:', uploadResponse.status);
          }
          
          // Clean up temp file
          fs.unlinkSync(req.file.path);
        } catch (storageError) {
          console.error('Object Storage error:', storageError);
          // Fallback to local storage for now
          const filename = `${Date.now()}-${req.file.originalname}`;
          const filepath = path.join(uploadDir, filename);
          fs.renameSync(req.file.path, filepath);
          immagineUrl = `/uploads/${filename}`;
        }
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
      
      // Convert form data types properly for updates
      const formData: any = {};
      if (req.body.nomeArticolo !== undefined) formData.nomeArticolo = req.body.nomeArticolo;
      if (req.body.taglia !== undefined) formData.taglia = req.body.taglia;
      if (req.body.costo !== undefined) formData.costo = req.body.costo;
      if (req.body.quantita !== undefined) formData.quantita = parseInt(req.body.quantita);
      
      const updates = insertInventarioSchema.partial().parse(formData);
      
      // Solo aggiorna l'immagine se è stata fornita una nuova immagine
      if (req.file) {
        try {
          // Use Object Storage for inventory images
          const objectStorageService = new ObjectStorageService();
          const uploadURL = await objectStorageService.getInventoryImageUploadURL();
          
          // Upload file to Object Storage
          const fileBuffer = fs.readFileSync(req.file.path);
          const uploadResponse = await fetch(uploadURL, {
            method: 'PUT',
            body: fileBuffer,
            headers: {
              'Content-Type': req.file.mimetype,
            }
          });

          if (uploadResponse.ok) {
            // Normalize the URL for our system
            (updates as any).immagineUrl = objectStorageService.normalizeObjectEntityPath(uploadURL.split('?')[0]);
          } else {
            console.error('Failed to upload to Object Storage:', uploadResponse.status);
          }
          
          // Clean up temp file
          fs.unlinkSync(req.file.path);
        } catch (storageError) {
          console.error('Object Storage error:', storageError);
          // Fallback to local storage for now
          const filename = `${Date.now()}-${req.file.originalname}`;
          const filepath = path.join(uploadDir, filename);
          fs.renameSync(req.file.path, filepath);
          (updates as any).immagineUrl = `/uploads/${filename}`;
        }
      }
      // Se non è stata fornita una nuova immagine, l'immagineUrl esistente rimane invariata

      const item = await storage.updateInventoryItem(id, req.session.activityId!, updates);
      if (!item) {
        return res.status(404).json({ message: "Articolo non trovato" });
      }

      // Invalidate expenses query to reflect the automatic expense update
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

  app.put('/api/vendite/:id', requireActivity, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Convert form data types
      const formData = {
        inventarioId: req.body.inventarioId,
        quantita: parseInt(req.body.quantita) || 1,
        prezzoVendita: req.body.prezzoVendita,
        incassatoDa: req.body.incassatoDa,
        incassatoSu: req.body.incassatoSu,
        data: new Date(req.body.data)
      };
      
      const updates = insertVenditaSchema.partial().parse(formData);
      
      // Get existing sale to compare quantities and calculate margin difference
      const existingSale = await storage.getSaleById(id, req.session.activityId!);
      if (!existingSale) {
        return res.status(404).json({ message: "Vendita non trovata" });
      }
      
      // Get inventory item to calculate new margin and article info
      const inventoryItem = await storage.getInventoryItem(updates.inventarioId || existingSale.inventarioId, req.session.activityId!);
      if (!inventoryItem) {
        return res.status(404).json({ message: "Articolo non trovato nell'inventario" });
      }
      
      // Calculate new margin
      const newPrice = updates.prezzoVendita || existingSale.prezzoVendita;
      const newQuantity = updates.quantita || existingSale.quantita;
      const marginePerUnit = Number(newPrice) - Number(inventoryItem.costo);
      const margineTotal = marginePerUnit * newQuantity;
      
      // Update sale with new margin and article info (inventory quantities are handled in updateSale)
      const updatedSale = await storage.updateSale(id, req.session.activityId!, {
        ...updates,
        nomeArticolo: inventoryItem.nomeArticolo,
        taglia: inventoryItem.taglia,
        margine: margineTotal.toString(),
      });
      
      res.json(updatedSale);
    } catch (error: any) {
      console.error('Sale update error:', error);
      res.status(400).json({ message: error.message || "Errore nell'aggiornamento della vendita" });
    }
  });

  app.delete('/api/vendite/:id', requireActivity, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSale(id, req.session.activityId!);
      
      if (!deleted) {
        return res.status(404).json({ message: "Vendita non trovata" });
      }

      res.json({ message: "Vendita eliminata con successo" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nell'eliminazione della vendita" });
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

  // Fund transfers routes
  app.get('/api/fund-transfers', requireActivity, async (req, res) => {
    try {
      const transfers = await storage.getFundTransfersByActivity(req.session.activityId!);
      res.json(transfers);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero dei trasferimenti fondi" });
    }
  });

  app.post('/api/fund-transfers', requireActivity, async (req, res) => {
    try {
      const { transfers } = req.body;
      
      if (!transfers || !Array.isArray(transfers) || transfers.length === 0) {
        return res.status(400).json({ message: "Almeno un trasferimento è richiesto" });
      }

      // Validate each transfer
      const validatedTransfers = transfers.map((transfer: any) => {
        if (!transfer.fromMember || !transfer.fromAccount || !transfer.importo) {
          throw new Error("Campi richiesti mancanti nel trasferimento");
        }
        
        const amount = Number(transfer.importo);
        if (isNaN(amount) || amount <= 0) {
          throw new Error("Importo non valido");
        }

        return {
          fromMember: transfer.fromMember,
          fromAccount: transfer.fromAccount,
          toAccount: transfer.toAccount || "Cassa Reinvestimento",
          importo: amount.toString(),
          descrizione: transfer.descrizione || null,
          userId: req.session.userId!,
          activityId: req.session.activityId!
        };
      });

      const createdTransfers = await storage.createFundTransfers(validatedTransfers);
      
      res.json({
        message: "Trasferimenti completati con successo",
        transfers: createdTransfers
      });
    } catch (error: any) {
      console.error('Fund transfer error:', error);
      res.status(400).json({ message: error.message || "Errore nel trasferimento fondi" });
    }
  });

  // Financial history routes  
  app.get('/api/financial-history', requireActivity, async (req, res) => {
    try {
      const history = await storage.getFinancialHistoryByActivity(req.session.activityId!);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Errore nel recupero della cronologia finanziaria" });
    }
  });

  // Admin authentication route
  app.post("/api/admin/auth", async (req, res) => {
    try {
      const { password } = req.body;
      // Simple admin password check - in production, use environment variable
      const adminPassword = process.env.ADMIN_PASSWORD || "Alby1989@";
      
      if (password !== adminPassword) {
        return res.status(401).json({ message: "Password amministratore non corretta" });
      }
      
      // Set admin session
      (req.session as any).adminAuthenticated = true;
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin auth error:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
