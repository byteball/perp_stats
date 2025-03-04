import * as db from 'ocore/db';

export async function run(): Promise<void> {
  console.log('Running database migrations...');

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS perp_price_history (
        aa_address TEXT NOT NULL,
        mci INTEGER NOT NULL,
        asset TEXT NOT NULL,
        not_for_use INTEGER NOT NULL DEFAULT 0,
        price REAL NOT NULL,
        price_from_response REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        creation_date INTEGER DEFAULT (CURRENT_TIMESTAMP),
        CONSTRAINT perp_price_history_pk PRIMARY KEY (aa_address,asset,timestamp)
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_perp_price_asset_timestamp 
      ON perp_price_history (asset, timestamp, price, price_from_response, not_for_use)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_perp_price_timestamp 
      ON perp_price_history (timestamp)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_perp_price_mci_desc
      ON perp_price_history (mci DESC)
    `);

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}
