import * as db from 'ocore/db';

export async function run(): Promise<void> {
  console.log('Running database migrations...');

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS snapshot_history (
        aa_address TEXT NOT NULL,
        asset TEXT NOT NULL,
        is_realtime INTEGER NOT NULL DEFAULT 0,
        usd_price REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        creation_date INTEGER DEFAULT (CURRENT_TIMESTAMP),
        CONSTRAINT snapshot_history_pk PRIMARY KEY (aa_address,asset,timestamp)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS trades_history (
        aa_address TEXT NOT NULL,
        trigger_unit TEXT NOT NULL,
        mci INTEGER NOT NULL,
        asset TEXT NOT NULL,
        is_realtime INTEGER NOT NULL DEFAULT 0,
        usd_price REAL NOT NULL,
        price_in_reserve REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        creation_date INTEGER DEFAULT (CURRENT_TIMESTAMP),
        CONSTRAINT trades_history_pk PRIMARY KEY (aa_address,asset,timestamp)
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_snapshot_asset_timestamp 
      ON snapshot_history (asset, timestamp)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_trades_asset_timestamp 
      ON trades_history (asset, timestamp)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_snapshot_timestamp 
      ON snapshot_history (timestamp)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_trades_timestamp 
      ON trades_history (timestamp)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_trades_mci_desc
      ON trades_history (mci DESC)
    `);

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}
