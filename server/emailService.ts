import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';

// Create email transporter
const smtpPort = Number(process.env.SMTP_PORT || 587);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: smtpPort,
  secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
  auth: {
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASS!,
  },
});

// Generate verification token
export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

// Generate password reset token
export function generatePasswordResetToken(): string {
  return randomBytes(32).toString('hex');
}

// Calculate token expiration (24 hours from now)
export function getTokenExpiration(): Date {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + 24);
  return expiration;
}

// Test SMTP configuration
export async function testEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('✅ SMTP configuration is valid');
    return true;
  } catch (error) {
    console.error('❌ SMTP configuration error:', error);
    return false;
  }
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const testDomains = ['test.com', 'example.com', 'fake.com', 'dummy.com'];
  
  if (!emailRegex.test(email)) return false;
  
  const domain = email.split('@')[1]?.toLowerCase();
  return !testDomains.includes(domain);
}

// Send verification email
export async function sendVerificationEmail(
  email: string,
  nome: string,
  cognome: string,
  token: string,
  baseUrlParam?: string
): Promise<void> {
  // Validate email before sending
  if (!isValidEmail(email)) {
    console.log(`⚠️ Skipping email send to invalid/test address: ${email}`);
    throw new Error(`Indirizzo email non valido o di test: ${email}`);
  }

  // Use the baseUrl parameter or fallback to environment variables
  const baseUrl =
    baseUrlParam
    ?? process.env.PUBLIC_BASE_URL
    ?? (process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'http://localhost:5000');

  const verificationUrl = `${baseUrl}/api/auth/verify-email/${token}`;

  const mailOptions = {
    from: {
      name: 'BUYS - Build Up Your Store',
      address: process.env.EMAIL_USER!,
    },
    to: email,
    subject: 'Conferma la tua registrazione a BUYS',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conferma la tua registrazione</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">BUYS</h1>
          <p style="color: white; margin: 5px 0 0 0; opacity: 0.9;">Build Up Your Store</p>
        </div>
        
        <div style="background: white; padding: 40px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Ciao ${nome} ${cognome}!</h2>
          
          <p>Benvenuto in <strong>BUYS</strong>, la piattaforma per gestire il tuo store.</p>
          
          <p>Per completare la registrazione e accedere a tutte le funzionalità, devi confermare il tuo indirizzo email cliccando sul pulsante qui sotto:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              ✓ Conferma Email
            </a>
          </div>
          
          <p>Se il pulsante non funziona, copia e incolla questo link nel tuo browser:</p>
          <p style="background: #f8f9fa; padding: 10px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 14px;">${verificationUrl}</p>
          
          <hr style="border: none; border-top: 1px solid #e1e5e9; margin: 30px 0;">
          
          <p style="font-size: 14px; color: #666;">
            <strong>Importante:</strong> Questo link è valido per 24 ore. Se non confermi entro questo periodo, dovrai registrarti nuovamente.
          </p>
          
          <p style="font-size: 14px; color: #666;">
            Se non hai richiesto questa registrazione, puoi ignorare questa email.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e5e9; text-align: center; color: #666; font-size: 12px;">
            <p>Questa email è stata inviata da BUYS - Build Up Your Store</p>
            <p>Sistema di gestione per negozi di abbigliamento</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Ciao ${nome} ${cognome}!

Benvenuto in BUYS, la piattaforma per gestire il tuo store.

Per completare la registrazione e accedere a tutte le funzionalità, devi confermare il tuo indirizzo email visitando questo link:

${verificationUrl}

Questo link è valido per 24 ore. Se non confermi entro questo periodo, dovrai registrarti nuovamente.

Se non hai richiesto questa registrazione, puoi ignorare questa email.

---
BUYS - Build Up Your Store
Sistema di gestione per il tuo store.
    `,
  };

  try {
    console.log(`📧 Sending verification email to ${email}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent successfully to ${email}`, info.messageId);
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    // Log the specific error details
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.EMAIL_USER ? '***configured***' : 'NOT SET'
      });
    }
    throw new Error('Failed to send verification email');
  }
}

// Send welcome email after verification
export async function sendWelcomeEmail(
  email: string,
  nome: string,
  cognome: string,
  baseUrlParam?: string
): Promise<void> {
  if (!isValidEmail(email)) {
    console.log(`⚠️ Skipping welcome email to invalid/test address: ${email}`);
    return;
  }
  const baseUrl =
    baseUrlParam
    ?? process.env.PUBLIC_BASE_URL
    ?? (process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'http://localhost:5000');
  const loginUrl = `${baseUrl}/`;

  const mailOptions = {
    from: {
      name: 'BUYS - Build Up Your Store',
      address: process.env.EMAIL_USER!,
    },
    to: email,
    subject: 'Benvenuto in BUYS! Account verificato con successo',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Benvenuto in BUYS</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Benvenuto in BUYS!</h1>
          <p style="color: white; margin: 5px 0 0 0; opacity: 0.9;">Build Up Your Store</p>
        </div>
        
        <div style="background: white; padding: 40px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Complimenti ${nome}!</h2>
          
          <p>Il tuo account è stato verificato con successo. Ora puoi accedere a tutte le funzionalità di <strong>BUYS</strong>:</p>
          
          <ul style="color: #555; padding-left: 20px;">
            <li><strong>Gestione Inventario</strong> - Tieni traccia dei tuoi articoli con taglie e immagini</li>
            <li><strong>Registrazione Vendite</strong> - Monitora le tue vendite e i margini di profitto</li>
            <li><strong>Controllo Spese</strong> - Gestisci le spese aziendali per categoria</li>
            <li><strong>Dashboard Finanziario</strong> - Visualizza grafici e statistiche del tuo business</li>
            <li><strong>Multi-Attività</strong> - Gestisci più negozi o attività in un unico account</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              🚀 Accedi a BUYS
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e1e5e9; margin: 30px 0;">
          
          <h3 style="color: #333;">Primi passi consigliati:</h3>
          <ol style="color: #555; padding-left: 20px;">
            <li>Crea la tua prima attività (negozio)</li>
            <li>Aggiungi alcuni articoli al tuo inventario</li>
            <li>Registra le tue prime vendite</li>
            <li>Esplora il dashboard per visualizzare le statistiche</li>
          </ol>
          
          <p style="background: #f0f8ff; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">
            💡 <strong>Suggerimento:</strong> Puoi gestire più negozi o attività con un singolo account BUYS. Ogni attività avrà i suoi dati separati e sicuri.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e5e9; text-align: center; color: #666; font-size: 12px;">
            <p>Grazie per aver scelto BUYS - Build Up Your Store</p>
            <p>Il sistema completo per la gestione del tuo store</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
}

// Send password reset email
export async function sendPasswordResetEmail(
  email: string,
  nome: string,
  cognome: string,
  token: string,
  baseUrlParam?: string
): Promise<void> {
  // Validate email before sending
  if (!isValidEmail(email)) {
    console.log(`⚠️ Skipping password reset email to invalid/test address: ${email}`);
    throw new Error(`Indirizzo email non valido o di test: ${email}`);
  }

  const baseUrl =
    baseUrlParam
    ?? process.env.PUBLIC_BASE_URL
    ?? (process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
          : 'http://localhost:5000');

  const resetUrl = `${baseUrl}/reset-password/${token}`;

  const mailOptions = {
    from: {
      name: 'BUYS - Build Up Your Store',
      address: process.env.EMAIL_USER!,
    },
    to: email,
    subject: 'Reset della Password - BUYS',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🔑 Reset Password</h1>
          <p style="color: white; margin: 5px 0 0 0; opacity: 0.9;">BUYS - Build Up Your Store</p>
        </div>
        
        <div style="background: white; padding: 40px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Ciao ${nome} ${cognome}!</h2>
          
          <p>Hai richiesto il reset della password per il tuo account <strong>BUYS</strong>.</p>
          
          <p>Se hai effettuato questa richiesta, clicca sul pulsante qui sotto per reimpostare la tua password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              🔑 Reimposta Password
            </a>
          </div>
          
          <p>Se il pulsante non funziona, copia e incolla questo link nel tuo browser:</p>
          <p style="background: #f8f9fa; padding: 10px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 14px;">${resetUrl}</p>
          
          <hr style="border: none; border-top: 1px solid #e1e5e9; margin: 30px 0;">
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Importante:</strong>
            </p>
            <ul style="margin: 10px 0; color: #856404; padding-left: 20px;">
              <li>Questo link è valido per 24 ore</li>
              <li>Se non hai richiesto il reset, ignora questa email</li>
              <li>La tua password attuale rimane valida fino al reset</li>
            </ul>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            Se non hai richiesto il reset della password, la tua password è ancora sicura e non devi fare nulla.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e5e9; text-align: center; color: #666; font-size: 12px;">
            <p>Questa email è stata inviata da BUYS - Build Up Your Store</p>
            <p>Sistema di gestione per il tuo store.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Ciao ${nome} ${cognome}!

Hai richiesto il reset della password per il tuo account BUYS.

Se hai effettuato questa richiesta, visita questo link per reimpostare la tua password:

${resetUrl}

IMPORTANTE:
- Questo link è valido per 24 ore
- Se non hai richiesto il reset, ignora questa email
- La tua password attuale rimane valida fino al reset

Se non hai richiesto il reset della password, la tua password è ancora sicura e non devi fare nulla.

---
BUYS - Build Up Your Store
Sistema di gestione per il tuo store.
    `,
  };

  try {
    console.log(`📧 Sending password reset email to ${email}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent successfully to ${email}`, info.messageId);
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

// Send password change confirmation email
export async function sendPasswordChangeConfirmationEmail(
  email: string,
  nome: string,
  cognome: string
): Promise<void> {
  const loginUrl = `${process.env.NODE_ENV === 'production' 
    ? `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}` 
    : 'http://localhost:5000'}/`;

  const mailOptions = {
    from: {
      name: 'BUYS - Build Up Your Store',
      address: process.env.EMAIL_USER!,
    },
    to: email,
    subject: 'Password Cambiata con Successo - BUYS',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Cambiata</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✅ Password Cambiata</h1>
          <p style="color: white; margin: 5px 0 0 0; opacity: 0.9;">BUYS - Build Up Your Store</p>
        </div>
        
        <div style="background: white; padding: 40px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Ciao ${nome}!</h2>
          
          <p>La password del tuo account <strong>BUYS</strong> è stata cambiata con successo.</p>
          
          <div style="background: #d4edda; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745; margin: 20px 0;">
            <p style="margin: 0; color: #155724;">
              <strong>✅ Operazione completata:</strong> La tua password è stata aggiornata in modo sicuro.
            </p>
          </div>
          
          <p>Ora puoi accedere al tuo account utilizzando la nuova password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              🚀 Accedi a BUYS
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e1e5e9; margin: 30px 0;">
          
          <div style="background: #f8d7da; padding: 15px; border-radius: 5px; border-left: 4px solid #dc3545; margin: 20px 0;">
            <p style="margin: 0; color: #721c24;">
              <strong>🚨 Non hai cambiato tu la password?</strong>
            </p>
            <p style="margin: 10px 0 0 0; color: #721c24;">
              Se non sei stato tu a cambiare la password, contatta immediatamente il supporto e cambia nuovamente la password.
            </p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e5e9; text-align: center; color: #666; font-size: 12px;">
            <p>Questa email è stata inviata da BUYS - Build Up Your Store</p>
            <p>Sistema di gestione per il tuo store.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
}