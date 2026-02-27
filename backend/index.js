const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors({
    origin: '*', // Allow all origins for the game (including Vercel deployment)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Set higher limit for restore JSON payloads
app.use(bodyParser.json({ limit: '10mb' }));

// --- 🔧 GAME CONFIGURATION (EDIT THIS) ---
const GAME_CONFIG = {
    STARTING_CASH: 1000,          // Every team starts with this amount
    SLOPE: 0.6,                   // Impact of demand on price
    UPPER_CIRCUIT: 1.25,          // Max price multiplier (e.g. 1.25x)
    LOWER_CIRCUIT: 0.75,          // Min price multiplier (e.g. 0.75x)
    OPTION_PREMIUM_NEXT: 0.10,    // Premium for Next Round (10%)
    OPTION_PREMIUM_FAR: 0.15,     // Premium for Round after Next (15%)
    SHOCK_DEFAULT: 1.0            // Default shock factor
};

// --- IN-MEMORY DATA STATE ---
let currentRound = 1;

// 1. Stocks Data
let stocks = [
    { id: 'nestle', name: 'Nestle', basePrice: 73, currentPrice: 73, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'britannia', name: 'Britannia', basePrice: 65, currentPrice: 65, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'bikaji', name: 'Bikaji', basePrice: 64, currentPrice: 64, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'heritage', name: 'Heritage Foods', basePrice: 49, currentPrice: 49, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'sbi', name: 'SBI', basePrice: 93, currentPrice: 93, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'icici', name: 'ICICI Bank', basePrice: 77, currentPrice: 77, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'au_bank', name: 'AU Small Finance Bank', basePrice: 54, currentPrice: 54, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'dhanlaxmi', name: 'Dhanlaxmi Bank', basePrice: 54, currentPrice: 54, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'zomato', name: 'Zomato', basePrice: 84, currentPrice: 84, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'paytm', name: 'Paytm', basePrice: 70, currentPrice: 70, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'policybazaar', name: 'PolicyBazaar', basePrice: 62, currentPrice: 62, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'cartrade', name: 'CarTrade', basePrice: 62, currentPrice: 63, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'tcs', name: 'TCS', basePrice: 87, currentPrice: 87, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'infosys', name: 'Infosys', basePrice: 75, currentPrice: 75, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'coforge', name: 'Coforge', basePrice: 62, currentPrice: 62, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'nucleus', name: 'Nucleus Software', basePrice: 53, currentPrice: 54, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'sunpharma', name: 'Sun Pharma', basePrice: 82, currentPrice: 83, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'drreddy', name: 'Dr Reddy', basePrice: 72, currentPrice: 74, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'biocon', name: 'Biocon', basePrice: 62, currentPrice: 63, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
    { id: 'unichem', name: 'Unichem Labs', basePrice: 55, currentPrice: 56, demand: 0, shockFactor: GAME_CONFIG.SHOCK_DEFAULT },
];

// 2. Teams (Tracks CASH + STOCKS)
// Structure: { 'team1': { cash: 1000, stocks: { 'nestle': 10 } } }
let teams = {};

// 3. Options Ledger
let optionsLedger = [];
let pendingPayouts = [];

// 4. Scheduled Shocks for Future Rounds
// 5. Configurable Slope
let currentSlope = GAME_CONFIG.SLOPE;

// --- HELPER FUNCTIONS ---

// Ensure team exists with starting cash
function getTeam(teamId) {
    if (!teams[teamId]) {
        teams[teamId] = {
            cash: GAME_CONFIG.STARTING_CASH,
            stocks: {},
            lockedStocks: {} // Tracks stocks bought THIS round that cannot be sold until next round
        };
    }
    return teams[teamId];
}

function calculatePrice(stock) {
    const demandEffect = 1 + (stock.demand * currentSlope) / 100;
    let rawPrice = stock.basePrice * demandEffect;

    const upperLimit = stock.basePrice * GAME_CONFIG.UPPER_CIRCUIT;
    const lowerLimit = stock.basePrice * GAME_CONFIG.LOWER_CIRCUIT;

    let cappedPrice = Math.min(Math.max(rawPrice, lowerLimit), upperLimit);
    let finalPrice = cappedPrice * stock.shockFactor;

    // Return price with exactly 1 decimal place
    return parseFloat(finalPrice.toFixed(1));
}

function updateStockPrice(stockId) {
    const stock = stocks.find(s => s.id === stockId);
    if (stock) stock.currentPrice = calculatePrice(stock);
}

// --- API ENDPOINTS ---

// 1. GET MARKET STATUS
app.get('/api/market', (req, res) => {
    res.json({ round: currentRound, stocks });
});

// 2. GET TEAM INFO (For Broker to see Cash)
app.get('/api/team/:id', (req, res) => {
    const team = getTeam(req.params.id);
    res.json(team);
});

// 3. STOCK TRADE
app.post('/api/trade/stock', (req, res) => {
    const { teamId, stockId, type, quantity } = req.body;

    // --- BASIC INPUT VALIDATION ---
    if (!teamId || !stockId || !type || !quantity) {
        return res.status(400).json({ error: "Missing required parameters (teamId, stockId, type, quantity)" });
    }
    if (type !== 'BUY' && type !== 'SELL') {
        return res.status(400).json({ error: "Invalid trade type. Must be BUY or SELL" });
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: "Invalid quantity. Must be a positive number." });
    }
    // ----------------------------

    const stock = stocks.find(s => s.id === stockId);
    if (!stock) return res.status(404).json({ error: "Stock not found" });

    const team = getTeam(teamId);
    const tradeValue = stock.currentPrice * qty;

    // Initialize stock holding if new
    if (!team.stocks[stockId]) team.stocks[stockId] = 0;
    if (!team.lockedStocks[stockId]) team.lockedStocks[stockId] = 0;

    if (type === 'BUY') {
        // CHECK 1: Enough Cash?
        if (team.cash < tradeValue) {
            return res.status(400).json({ error: `Not enough cash! Need ₹${tradeValue}, have ₹${team.cash}` });
        }
        team.cash -= tradeValue;
        team.stocks[stockId] += qty;
        team.lockedStocks[stockId] += qty; // Lock these shares for the current round
        stock.demand += qty;
    } else if (type === 'SELL') {
        const availableToSell = team.stocks[stockId] - team.lockedStocks[stockId];
        // CHECK 2: Enough Unlocked Stocks?
        if (team.stocks[stockId] < qty) {
            return res.status(400).json({ error: `Not enough stocks! Have ${team.stocks[stockId]}` });
        }
        if (availableToSell < qty) {
            return res.status(400).json({ error: `Cannot sell stocks bought in the current round! Wait for next round.` });
        }

        team.cash += tradeValue;
        team.stocks[stockId] -= qty;
        stock.demand -= qty;
    }

    updateStockPrice(stockId);

    // FIXED: Added cashToCollectOrGive so Broker knows the amount
    res.json({
        message: "Trade Successful",
        newCash: team.cash,
        executionPrice: stock.currentPrice,
        cashToCollectOrGive: tradeValue  // REQUIRED: Broker sees this amount
    });
});

// 4. OPTION TRADE
app.post('/api/trade/option', (req, res) => {
    const { teamId, stockId, type, quantity, expiryDelay } = req.body;

    // --- BASIC INPUT VALIDATION ---
    if (!teamId || !stockId || !type || !quantity || !expiryDelay) {
        return res.status(400).json({ error: "Missing required parameters" });
    }
    if (type !== 'CALL' && type !== 'PUT') {
        return res.status(400).json({ error: "Invalid option type. Must be CALL or PUT" });
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: "Invalid quantity. Must be a positive number." });
    }
    const parsedExpiryDelay = parseInt(expiryDelay);
    if (isNaN(parsedExpiryDelay) || parsedExpiryDelay <= 0) {
        return res.status(400).json({ error: "Invalid expiry. Must be a positive integer." });
    }
    // ----------------------------

    const stock = stocks.find(s => s.id === stockId);
    if (!stock) return res.status(404).json({ error: "Stock not found" });

    const team = getTeam(teamId);
    if (!team.lockedStocks) team.lockedStocks = {};

    const percentage = parsedExpiryDelay === 2 ? GAME_CONFIG.OPTION_PREMIUM_FAR : GAME_CONFIG.OPTION_PREMIUM_NEXT;
    const premiumPerShare = parseFloat((stock.currentPrice * percentage).toFixed(1));
    const totalPremium = parseFloat((premiumPerShare * qty).toFixed(1));

    // CHECK: Enough Cash for Premium?
    if (team.cash < totalPremium) {
        return res.status(400).json({ error: `Not enough cash for premium! Need ₹${totalPremium}` });
    }

    // Deduct Premium
    team.cash -= totalPremium;

    const optionContract = {
        id: Date.now(),
        teamId, stockId, type,
        strikePrice: stock.currentPrice,
        quantity: qty,
        expiryRound: currentRound + parsedExpiryDelay,
        premiumPaid: totalPremium,
        status: 'ACTIVE'
    };

    optionsLedger.push(optionContract);

    // FIXED: Clearly explicit 'cashToCollect'
    res.json({
        message: "Option Purchased",
        newCash: team.cash,
        cashToCollect: totalPremium, // REQUIRED: Broker needs to take this cash
        contract: optionContract
    });
});

// 5. END ROUND & SETTLE OPTIONS
app.post('/api/admin/end-round', (req, res) => {
    const expiringOptions = optionsLedger.filter(o => o.expiryRound === currentRound && o.status === 'ACTIVE');
    let roundPayouts = [];

    expiringOptions.forEach(opt => {
        const stock = stocks.find(s => s.id === opt.stockId);
        const closingPrice = stock.currentPrice;
        let profitPerShare = 0;

        if (opt.type === 'CALL') profitPerShare = Math.max(0, closingPrice - opt.strikePrice);
        else if (opt.type === 'PUT') profitPerShare = Math.max(0, opt.strikePrice - closingPrice);

        const totalPayout = profitPerShare * opt.quantity;

        if (totalPayout > 0) {
            // FIXED: Option wins are added to balance carefully here
            const team = getTeam(opt.teamId);
            team.cash += totalPayout;

            roundPayouts.push({
                teamId: opt.teamId,
                amount: totalPayout,
                reason: `${opt.type} Win on ${stock.name}`
            });
        }
        opt.status = 'EXPIRED';
    });

    pendingPayouts = roundPayouts;

    // Reset Market for next round
    stocks.forEach(stock => {
        stock.basePrice = stock.currentPrice;
        stock.demand = 0;

        // Reset shock factor to default, UNLESS there is a scheduled shock for the new round
        stock.shockFactor = GAME_CONFIG.SHOCK_DEFAULT;
    });

    // Reset locked stocks for all teams (they can now sell stocks bought last round)
    for (const teamId in teams) {
        teams[teamId].lockedStocks = {};
    }

    currentRound++;

    // Apply Scheduled Shocks for the new round, if any
    if (scheduledShocks[currentRound]) {
        for (const [stockId, factor] of Object.entries(scheduledShocks[currentRound])) {
            const stock = stocks.find(s => s.id === stockId);
            if (stock) {
                stock.shockFactor = parseFloat(factor);
                stock.currentPrice = calculatePrice(stock);
            }
        }
    }

    // DISK AUTO-SAVE: Write a physical backup file exactly on round end for extra safety
    const backupState = { currentRound, stocks, teams, optionsLedger, pendingPayouts, scheduledShocks, currentSlope };
    fs.writeFile('game_backup.json', JSON.stringify(backupState, null, 2), (err) => {
        if (err) console.error("Auto-backup failed:", err);
    });

    res.json({ message: "Round Ended", payouts: roundPayouts });
});

// 6. SET AD-HOC SHOCKS (Immediate Effect)
app.post('/api/admin/set-shocks', (req, res) => {
    const { shocks } = req.body;
    for (const [stockId, factor] of Object.entries(shocks)) {
        const stock = stocks.find(s => s.id === stockId);
        if (stock) {
            stock.shockFactor = parseFloat(factor);
            stock.currentPrice = calculatePrice(stock);
        }
    }
    res.json({ message: "Immediate Shocks applied" });
});

// 6.5 SCHEDULE PER-ROUND SHOCKS
app.get('/api/admin/schedule-shocks', (req, res) => {
    res.json(scheduledShocks);
});

app.post('/api/admin/schedule-shocks', (req, res) => {
    const { schedule } = req.body;
    scheduledShocks = schedule;
    res.json({ message: "Schedule saved successfully", schedule: scheduledShocks });
});

// 7. BACKUP STATE
app.get('/api/admin/backup', (req, res) => {
    const backupState = {
        currentRound,
        stocks,
        teams,
        optionsLedger,
        pendingPayouts,
        scheduledShocks,
        currentSlope
    };
    res.json(backupState);
});

// 8. RESTORE STATE
app.post('/api/admin/restore', (req, res) => {
    const backup = req.body;

    if (!backup || !backup.currentRound || !backup.stocks || !backup.teams) {
        return res.status(400).json({ error: "Invalid backup file format" });
    }

    currentRound = backup.currentRound;
    stocks = backup.stocks;
    teams = backup.teams;
    optionsLedger = backup.optionsLedger || [];
    pendingPayouts = backup.pendingPayouts || [];
    scheduledShocks = backup.scheduledShocks || {};
    currentSlope = backup.currentSlope || GAME_CONFIG.SLOPE;

    res.json({ message: `System Restored to Round ${currentRound} successfully!` });
});

// 8.5 DYNAMIC SLOPE
app.get('/api/admin/slope', (req, res) => {
    res.json({ currentSlope });
});

app.post('/api/admin/slope', (req, res) => {
    const { slope } = req.body;
    const parsedSlope = parseFloat(slope);
    if (isNaN(parsedSlope) || parsedSlope < 0) {
        return res.status(400).json({ error: "Invalid slope value" });
    }
    currentSlope = parsedSlope;
    res.json({ message: `Slope successfully set to ${currentSlope}`, currentSlope });
});

// 9. GET PAYOUTS
app.get('/api/payouts', (req, res) => { res.json(pendingPayouts); });

// 10. LIVE LEADERBOARD
app.get('/api/leaderboard', (req, res) => {
    const leaderboard = Object.keys(teams).map(teamId => {
        const team = teams[teamId];
        let stockValue = 0;

        // Calculate value of all stocks held by this team
        for (const [stockId, qty] of Object.entries(team.stocks)) {
            const stock = stocks.find(s => s.id === stockId);
            if (stock && qty > 0) {
                stockValue += qty * stock.currentPrice;
            }
        }

        return {
            teamId,
            cash: team.cash,
            stockValue,
            totalValue: team.cash + stockValue
        };
    });

    // Sort by Total Value (Highest first)
    leaderboard.sort((a, b) => b.totalValue - a.totalValue);

    res.json(leaderboard);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Engine running on 0.0.0.0:${PORT}`));