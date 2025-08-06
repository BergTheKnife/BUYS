import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: parseInt(process.env.SMTP_PORT!),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASS!,
  },
});

// Generate verification token
export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

// Calculate token expiration (24 hours from now)
export function getTokenExpiration(): Date {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + 24);
  return expiration;
}

// Send verification email
export async function sendVerificationEmail(
  email: string,
  nome: string,
  cognome: string,
  token: string
): Promise<void> {
  const verificationUrl = `${process.env.NODE_ENV === 'production' 
    ? `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}` 
    : 'http://localhost:5000'}/api/auth/verify-email/${token}`;

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
          
          <p>Benvenuto in <strong>BUYS</strong>, la piattaforma per gestire il tuo negozio di abbigliamento.</p>
          
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

Benvenuto in BUYS, la piattaforma per gestire il tuo negozio di abbigliamento.

Per completare la registrazione e accedere a tutte le funzionalità, devi confermare il tuo indirizzo email visitando questo link:

${verificationUrl}

Questo link è valido per 24 ore. Se non confermi entro questo periodo, dovrai registrarti nuovamente.

Se non hai richiesto questa registrazione, puoi ignorare questa email.

---
BUYS - Build Up Your Store
Sistema di gestione per negozi di abbigliamento
    `,
  };

  await transporter.sendMail(mailOptions);
}

// Send welcome email after verification
export async function sendWelcomeEmail(
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
            <p>Il sistema completo per la gestione del tuo negozio di abbigliamento</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
}