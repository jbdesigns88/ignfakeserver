const dbPath = './db.json';

async function readDb() {
  try {
    return await fs.readJson(dbPath);
  } catch (err) {
    console.error('Error reading database:', err);
    return null;
  }
}

async function writeDb(data) {
  try {
    await fs.writeJson(dbPath, data);
  } catch (err) {
    console.error('Error writing database:', err);
  }
}
