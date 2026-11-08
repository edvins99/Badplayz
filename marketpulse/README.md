# MarketPulse on GitHub Pages

Public application: https://edvins99.github.io/Badplayz/marketpulse/

This is a personal, read-only market scanner. No accounts, payments, trading keys or orders. Exchange-listed stock/ETF/commodity tokens and derivatives are separate from owning the underlying shares or physical commodity.

## Using the application

- Open the URL. No Node.js process or localhost server is needed.
- **Kā lietot?** starts a 14-step interactive guide through the controls.
- Markets, Crypto, Stocks/ETF and Commodities show discovered instruments even without signals. Search, filter, sort, switch cards/table and open any instrument's chart.
- Stars save instruments to this browser. Charts support 30/80/160 candles and frozen signal overlays.
- MOVES, LEVELS and SLOPE show qualifying observations. Empty feeds remain empty when no rule qualifies; prices/signals are never silently replaced by simulated data.
- Settings and individual history use IndexedDB on this device. Export JSON to keep a copy. Different devices/browsers have separate preferences.

## Data and background work

The browser runs the same detectors in a Web Worker and queries the public Binance, Bybit and OKX market-data APIs. Initial quotes and observed signals come from a public, server-generated feed. Its data timestamp and source errors are visible; it does not pretend cached prices are fresh.

GitHub Actions refreshes the public feed approximately every 15 minutes even when the page is closed. Scheduled Actions can be delayed or skipped by GitHub, and auto-disable after prolonged repository inactivity. The scheduled workflow is also present on the repository's default branch and explicitly checks out `main` for deployment. It keeps the existing Badplayz root page and sibling projects.

The public pipeline uses a fresh in-memory SQLite database, public exchange data and the previous published public history only. It never reads a personal local database, account settings, Telegram identifiers or credentials. The latest 1,500 public signals and 1,000 announcements are retained in that feed.

The default background scan is 300 markets at 15m, while each browser can choose its own source/timeframe/settings. Exchange region restrictions and insufficient candle coverage produce explicit errors or blank RVOL. They are not bypassed. Public announcements cover Binance/Bybit and active-source market-list changes; their availability can differ from price data.

## Checks

`node marketpulse/_engine/check.mjs` verifies browser/server detector identity, SHA-256 compatibility, provider classification, settings and history contracts.

`node marketpulse/_engine/e2e.mjs` uses Playwright to check the complete browser application on a repository subpath, including real feed, charts, filters, persistence, export, all scanner sections, interactive guide and mobile navigation.

Information and education only. Not financial advice. No guaranteed profit. MFE/MAE are hypothetical price movement; fees, spread, slippage and funding are not deducted.
