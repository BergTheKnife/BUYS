
// Script temporaneo per verificare email non valide
import { db } from './server/db.js';

async function checkInvalidEmails() {
  try {
    const users = await db.query.users.findMany();
    console.log('Utenti con possibili email non valide:');
    
    users.forEach(user => {
      if (user.email.includes('test@') || user.email.includes('example.')) {
        console.log(`- ${user.nome} ${user.cognome}: ${user.email}`);
      }
    });
  } catch (error) {
    console.error('Errore:', error);
  }
}

checkInvalidEmails();
