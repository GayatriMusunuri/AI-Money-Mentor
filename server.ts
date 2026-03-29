import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

const calculateHealthScore = (data: any) => {
  const suggestions: string[] = [];
  const alerts: { type: 'warning' | 'info' | 'success'; message: string }[] = [];
  let score = 0;

  // 1. Emergency Fund (Target: 6 months of expenses)
  const monthsOfBuffer = data.expenses > 0 ? data.savings / data.expenses : 0;
  const emergencyScore = Math.min(20, (monthsOfBuffer / 6) * 20);
  score += emergencyScore;
  if (monthsOfBuffer < 3) {
    alerts.push({ type: 'warning', message: 'Critically low emergency fund! Aim for at least 6 months of expenses.' });
    suggestions.push("Prioritize building an emergency fund.");
  } else if (monthsOfBuffer < 6) {
    alerts.push({ type: 'info', message: 'Emergency fund is growing, but not yet optimal.' });
  }

  // 2. Debt-to-Income Ratio (Target: < 30%)
  const debtRatio = data.income > 0 ? (data.debt / data.income) * 100 : 0;
  const debtScore = debtRatio <= 30 ? 20 : Math.max(0, 20 - (debtRatio - 30));
  score += debtScore;
  if (debtRatio > 40) {
    alerts.push({ type: 'warning', message: 'High debt-to-income ratio. This could impact your financial stability.' });
    suggestions.push("Consider debt consolidation or aggressive repayment.");
  }

  // 3. Savings Rate (Target: >= 20%)
  const savingsRate = data.income > 0 ? ((data.income - data.expenses) / data.income) * 100 : 0;
  const savingsScore = Math.min(20, (savingsRate / 20) * 20);
  score += savingsScore;
  if (savingsRate < 10) {
    alerts.push({ type: 'warning', message: 'Very low savings rate. You are living paycheck to paycheck.' });
  }

  // 4. Insurance
  const insuranceScore = data.hasInsurance ? 20 : 0;
  score += insuranceScore;
  if (!data.hasInsurance) {
    alerts.push({ type: 'warning', message: 'Missing insurance! You are one medical emergency away from financial ruin.' });
    suggestions.push("Get comprehensive health and term life insurance immediately.");
  }

  // 5. Investment Ratio (Target: > 15% of income)
  const investmentRatio = data.income > 0 ? (data.investments / data.income) * 100 : 0;
  const investmentScore = Math.min(20, (investmentRatio / 15) * 20);
  score += investmentScore;
  if (investmentRatio < 5 && data.currentAge < 40) {
    alerts.push({ type: 'info', message: 'Low investment ratio for your age. Start compounding early.' });
  }

  return {
    score: Math.round(score),
    breakdown: {
      emergencyFund: Math.round(emergencyScore),
      debtRatio: Math.round(debtScore),
      savingsRate: Math.round(savingsScore),
      insurance: Math.round(insuranceScore),
      investmentRatio: Math.round(investmentScore),
    },
    suggestions,
    alerts,
  };
};

const calculateFIREPlan = (data: any) => {
  const inflation = 0.06;
  const expectedReturn = 0.10;
  const withdrawalRate = 0.04;
  
  const yearsToRetire = data.retirementAge - data.currentAge;
  const annualExpenses = data.expenses * 12;
  const futureAnnualExpenses = annualExpenses * Math.pow(1 + inflation, yearsToRetire);
  const requiredCorpus = futureAnnualExpenses / withdrawalRate;
  
  const r = expectedReturn / 12;
  const n = yearsToRetire * 12;
  
  let monthlySIP = 0;
  if (n > 0) {
    const existingInvestmentsFV = data.investments * Math.pow(1 + expectedReturn, yearsToRetire);
    const targetFromSIP = Math.max(0, requiredCorpus - existingInvestmentsFV);
    monthlySIP = targetFromSIP / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
  }

  const equity = Math.min(80, Math.max(20, 100 - data.currentAge));
  const debt = 100 - equity;

  // Wealth Projection
  const projection = [];
  let currentWealth = data.investments + data.savings;
  const monthlySavings = Math.max(0, data.income - data.expenses);

  for (let i = 0; i <= yearsToRetire; i++) {
    projection.push({
      year: new Date().getFullYear() + i,
      age: data.currentAge + i,
      wealth: Math.round(currentWealth),
    });
    // Compounding for the year
    currentWealth = (currentWealth + monthlySavings * 12) * (1 + expectedReturn);
  }

  return {
    requiredCorpus: Math.round(requiredCorpus),
    monthlySIP: Math.round(monthlySIP),
    assetAllocation: { equity, debt },
    yearsToRetire,
    projection,
  };
};

const calculateGoalPlan = (data: any, goals: any[]) => {
  const expectedReturn = 0.10;
  const r = expectedReturn / 12;

  return goals.map(goal => {
    const n = goal.timeframeYears * 12;
    const suggestedSIP = goal.targetAmount / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
    const monthlySavings = Math.max(0, data.income - data.expenses);
    
    return {
      goalId: goal.id,
      suggestedSIP: Math.round(suggestedSIP),
      isAchievable: suggestedSIP <= monthlySavings,
    };
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoints
  app.post("/api/analyze", (req, res) => {
    const { financialData, goals = [] } = req.body;
    const health = calculateHealthScore(financialData);
    const fire = calculateFIREPlan(financialData);
    const goalPlans = calculateGoalPlan(financialData, goals);
    res.json({ health, fire, goalPlans });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "AI Money Mentor Backend" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
