import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, Calendar, CheckCircle2, ChevronDown,
  CreditCard, Download, Edit2, LayoutDashboard, LogOut, Menu,
  Plus, ReceiptText, Search, ShieldCheck, Target, Trash2, Users, Wallet, X
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  api, type Account, type Budget, type Category, type Member,
  type Loan, type SavingsGoal, type Summary, type Transaction
} from './api';

const money = (value: number | string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));

const palette = ['#2f8f67', '#e5a64b', '#7b8fe8', '#d77d83', '#8854d0', '#20bf6b', '#fa8231', '#4b6584'];

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('ff360_access_token'));
  const [userProfile, setUserProfile] = useState<{ full_name: string; email: string; household_name: string } | null>(null);

  // Auth form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [household, setHousehold] = useState('My Family');
  const [registerMode, setRegisterMode] = useState(false);

  // App navigation & data
  const [tab, setTab] = useState('Overview');
  const [members, setMembers] = useState<Member[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);

  // Filtering states for Transactions
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterMember, setFilterMember] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Modals
  type ModalType = 'transaction' | 'edit_transaction' | 'member' | 'account' | 'budget' | 'goal' | 'goal_contribute' | 'loan' | 'loan_repay' | null;
  const [modal, setModal] = useState<ModalType>(null);

  // Editing / target states
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  // Form states
  const [memberName, setMemberName] = useState('');
  const [memberRelation, setMemberRelation] = useState('Other');

  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('bank');
  const [accOpening, setAccOpening] = useState('0.00');

  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txAccount, setTxAccount] = useState('');
  const [txMember, setTxMember] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 16));

  const [budgetName, setBudgetName] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');

  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalInitial, setGoalInitial] = useState('0.00');
  const [goalNotes, setGoalNotes] = useState('');
  const [goalContribAmount, setGoalContribAmount] = useState('');

  const [loanPerson, setLoanPerson] = useState('');
  const [loanType, setLoanType] = useState<'lent' | 'borrowed'>('lent');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanDesc, setLoanDesc] = useState('');
  const [loanRepayAmount, setLoanRepayAmount] = useState('');

  // UI status
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  function notifySuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  async function refresh() {
    try {
      const [m, a, c, s, b, g, l] = await Promise.all([
        api.members(),
        api.accounts(),
        api.categories(),
        api.summary(selectedMonth),
        api.budgets(),
        api.savingsGoals(),
        api.loans(),
      ]);
      setMembers(m);
      setAccounts(a);
      setCategories(c);
      setSummary(s);
      setBudgets(b);
      setSavingsGoals(g);
      setLoans(l);

      // Default transaction selections
      if (!txAccount && a.length) setTxAccount(a[0].id);
      if (!txMember && m.length) setTxMember(m[0].id);

      // Refresh transactions with current filter
      await fetchFilteredTransactions();

      // Refresh profile
      try {
        const p = await api.me();
        setUserProfile(p);
      } catch {
        // ignore
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh data');
    }
  }

  async function fetchFilteredTransactions() {
    try {
      const txs = await api.transactions({
        type: filterType || undefined,
        member_id: filterMember || undefined,
        category_id: filterCategory || undefined,
        month: selectedMonth || undefined,
        search: searchQuery || undefined,
      });
      setTransactions(txs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions');
    }
  }

  useEffect(() => {
    if (token) {
      refresh();
    }
  }, [token, selectedMonth]);

  useEffect(() => {
    if (token) {
      fetchFilteredTransactions();
    }
  }, [filterType, filterMember, filterCategory, searchQuery]);

  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = registerMode
        ? await api.register({ email, full_name: fullName, password, household_name: household })
        : await api.login(email, password);
      localStorage.setItem('ff360_access_token', result.access_token);
      setToken(result.access_token);
      notifySuccess(registerMode ? 'Household created successfully!' : 'Signed in successfully!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem('ff360_access_token');
    setToken(null);
    setUserProfile(null);
    setMembers([]);
    setAccounts([]);
    setTransactions([]);
    setSummary(null);
  }

  // Transaction Save (Create or Edit)
  async function saveTransaction(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (modal === 'edit_transaction' && editingTx) {
        await api.editTransaction(editingTx.id, {
          account_id: txAccount,
          member_id: txMember || null,
          category_id: txCategory || null,
          transaction_type: txType,
          amount: txAmount,
          description: txDescription.trim(),
          transaction_date: new Date(txDate).toISOString(),
        });
        notifySuccess('Transaction updated.');
      } else {
        await api.addTransaction({
          account_id: txAccount,
          member_id: txMember || null,
          category_id: txCategory || null,
          transaction_type: txType,
          amount: txAmount,
          description: txDescription.trim(),
          transaction_date: new Date(txDate).toISOString(),
          client_request_id: crypto.randomUUID(),
        });
        notifySuccess('Transaction recorded.');
      }
      setModal(null);
      setTxAmount('');
      setTxDescription('');
      setEditingTx(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save transaction');
    } finally {
      setBusy(false);
    }
  }

  async function removeTransaction(tx: Transaction) {
    if (!window.confirm(`Delete transaction "${tx.description}" (${money(tx.amount)})?`)) return;
    try {
      await api.deleteTransaction(tx.id);
      notifySuccess('Transaction deleted.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete transaction');
    }
  }

  function openEditTxModal(tx: Transaction) {
    setEditingTx(tx);
    setTxType(tx.transaction_type === 'income' ? 'income' : 'expense');
    setTxAmount(String(tx.amount));
    setTxDescription(tx.description);
    setTxAccount(tx.account_id);
    setTxMember(tx.member_id || '');
    setTxCategory(tx.category_id || '');
    setTxDate(new Date(tx.transaction_date).toISOString().slice(0, 16));
    setModal('edit_transaction');
  }

  // Member CRUD
  async function saveMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { name: memberName.trim(), relationship_label: memberRelation };
      if (editingMember) {
        await api.editMember(editingMember.id, payload);
        notifySuccess('Family member updated.');
      } else {
        await api.addMember(payload);
        notifySuccess('Family member added.');
      }
      await refresh();
      setModal(null);
      setEditingMember(null);
      setMemberName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save member');
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Deactivate ${member.name}? Their historical records will remain.`)) return;
    try {
      await api.deleteMember(member.id);
      notifySuccess(`${member.name} deactivated.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to deactivate member');
    }
  }

  // Account Save
  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.addAccount({
        name: accName.trim(),
        account_type: accType,
        opening_balance: accOpening || '0.00',
      });
      notifySuccess('Account created successfully.');
      setModal(null);
      setAccName('');
      setAccOpening('0.00');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add account');
    } finally {
      setBusy(false);
    }
  }

  // Budget Save & Delete
  async function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.addBudget({
        name: budgetName.trim(),
        category_id: budgetCategory || null,
        monthly_limit: budgetLimit,
      });
      notifySuccess('Monthly budget created.');
      setModal(null);
      setBudgetName('');
      setBudgetLimit('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create budget');
    } finally {
      setBusy(false);
    }
  }

  async function removeBudget(id: string) {
    if (!window.confirm('Delete this budget?')) return;
    try {
      await api.deleteBudget(id);
      notifySuccess('Budget removed.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete budget');
    }
  }

  // Savings Goal Save, Contribute & Delete
  async function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.addSavingsGoal({
        name: goalName.trim(),
        target_amount: goalTarget,
        current_amount: goalInitial || '0.00',
        notes: goalNotes.trim() || undefined,
      });
      notifySuccess('Savings goal set.');
      setModal(null);
      setGoalName('');
      setGoalTarget('');
      setGoalNotes('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create goal');
    } finally {
      setBusy(false);
    }
  }

  async function saveGoalContribution(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGoal) return;
    setBusy(true);
    setError('');
    try {
      await api.contributeSavingsGoal(selectedGoal.id, goalContribAmount);
      notifySuccess(`Added ${money(goalContribAmount)} to "${selectedGoal.name}".`);
      setModal(null);
      setSelectedGoal(null);
      setGoalContribAmount('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to contribute to goal');
    } finally {
      setBusy(false);
    }
  }

  async function removeGoal(id: string) {
    if (!window.confirm('Delete this savings goal?')) return;
    try {
      await api.deleteSavingsGoal(id);
      notifySuccess('Goal deleted.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete goal');
    }
  }

  // Loans Save, Repayment & Delete
  async function saveLoan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.addLoan({
        person_name: loanPerson.trim(),
        loan_type: loanType,
        principal_amount: loanPrincipal,
        description: loanDesc.trim() || undefined,
      });
      notifySuccess('Loan recorded.');
      setModal(null);
      setLoanPerson('');
      setLoanPrincipal('');
      setLoanDesc('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save loan');
    } finally {
      setBusy(false);
    }
  }

  async function saveLoanRepayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLoan) return;
    setBusy(true);
    setError('');
    try {
      await api.recordLoanRepayment(selectedLoan.id, loanRepayAmount);
      notifySuccess(`Repayment of ${money(loanRepayAmount)} recorded.`);
      setModal(null);
      setSelectedLoan(null);
      setLoanRepayAmount('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record repayment');
    } finally {
      setBusy(false);
    }
  }

  async function removeLoan(id: string) {
    if (!window.confirm('Delete this loan record?')) return;
    try {
      await api.deleteLoan(id);
      notifySuccess('Loan deleted.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete loan');
    }
  }

  // Chart data
  const chartData = useMemo(() => [
    { name: 'Income', value: Number(summary?.total_income || 0) },
    { name: 'Expenses', value: Number(summary?.total_expenses || 0) },
    { name: 'Savings', value: Math.max(0, Number(summary?.net_savings || 0)) },
  ].filter(x => x.value > 0), [summary]);

  const categoryBreakdownData = useMemo(() => {
    return (summary?.category_breakdown || []).map(c => ({
      name: c.category_name,
      value: Number(c.total_amount),
      pct: c.percentage,
    }));
  }, [summary]);

  // Total lent & borrowed calculations
  const totalLentRemaining = useMemo(() =>
    loans.filter(l => l.loan_type === 'lent' && !l.is_settled)
      .reduce((acc, curr) => acc + Number(curr.remaining_amount), 0),
    [loans]
  );

  const totalBorrowedRemaining = useMemo(() =>
    loans.filter(l => l.loan_type === 'borrowed' && !l.is_settled)
      .reduce((acc, curr) => acc + Number(curr.remaining_amount), 0),
    [loans]
  );

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-mark"><Wallet size={25} /></div>
          <p className="eyebrow">YOUR HOUSEHOLD, IN BALANCE</p>
          <h1>Family Finance <span>360</span></h1>
          <p className="muted">A clearer view of everything your family earns, spends and saves in INR (₹).</p>
          <form onSubmit={authenticate} className="form-stack">
            {registerMode && (
              <>
                <label>
                  Your full name
                  <input required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Ramesh Patel" />
                </label>
                <label>
                  Family / Household name
                  <input required value={household} onChange={e => setHousehold(e.target.value)} placeholder="e.g. Patel Family" />
                </label>
              </>
            )}
            <label>
              Email address
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                minLength={registerMode ? 12 : 1}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={registerMode ? 'At least 12 characters' : 'Your password'}
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="primary full" disabled={busy}>
              {busy ? 'Please wait…' : registerMode ? 'Create household workspace' : 'Sign in securely'}
            </button>
          </form>
          <button className="text-button" onClick={() => { setRegisterMode(!registerMode); setError(''); }}>
            {registerMode ? 'Already registered? Sign in' : 'New here? Create your family account'}
          </button>
          <p className="security-note"><ShieldCheck size={15} /> Argon2id encryption · INR · Neon PostgreSQL</p>
        </section>
      </main>
    );
  }

  const nav = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Transactions', icon: ReceiptText },
    { name: 'Family members', icon: Users },
    { name: 'Accounts', icon: CreditCard },
    { name: 'Budgets & goals', icon: Target },
    { name: 'Loans & ledger', icon: Activity },
  ];

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="side-brand">
          <div className="brand-mark small"><Wallet size={19} /></div>
          <div>
            <b>Family Finance</b>
            <small>360 · HOUSEHOLD</small>
          </div>
          <button className="icon-button close-nav" onClick={() => setMobileNav(false)}><X /></button>
        </div>

        <div className="workspace">
          <span className="avatar">{(userProfile?.household_name || 'F').slice(0, 1).toUpperCase()}</span>
          <div>
            <b>{userProfile?.household_name || 'My Family'}</b>
            <small>{userProfile?.full_name || 'Owner'}</small>
          </div>
          <ChevronDown size={15} />
        </div>

        <p className="nav-label">WORKSPACE</p>
        {nav.map(item => (
          <button
            key={item.name}
            className={`nav-item ${tab === item.name ? 'active' : ''}`}
            onClick={() => { setTab(item.name); setMobileNav(false); }}
          >
            <item.icon size={18} />
            {item.name}
          </button>
        ))}

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={logout}><LogOut size={18} />Sign out</button>
          <div className="plan-note">
            <ShieldCheck size={16} />
            <span>
              <b>Private & Secured</b>
              <small>Scoped to your household</small>
            </span>
          </div>
        </div>
      </aside>

      {mobileNav && <button aria-label="Close navigation" className="scrim" onClick={() => setMobileNav(false)} />}

      {/* Main Area */}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(true)}><Menu /></button>
          <div className="crumb">Workspace <span>/</span> <b>{tab}</b></div>
          <div className="top-actions">
            <span className="date-label">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button className="icon-button" title="Notifications"><Bell size={18} /></button>
            <span className="avatar">{(userProfile?.full_name || 'U').slice(0, 1).toUpperCase()}</span>
          </div>
        </header>

        <div className="content">
          {/* Page Heading & Quick Actions */}
          <div className="page-heading">
            <div>
              <p className="eyebrow">FAMILY FINANCE WORKSPACE</p>
              <h1>{tab === 'Overview' ? `Welcome back, ${userProfile?.full_name?.split(' ')[0] || ''}` : tab}</h1>
              <p className="muted">
                {tab === 'Overview' && 'Complete financial pulse of your household this month.'}
                {tab === 'Transactions' && 'Search, filter, edit, and export household income and expenses.'}
                {tab === 'Family members' && 'Manage profiles and track spending habits per family member.'}
                {tab === 'Accounts' && 'Bank accounts, cash reserves, and live calculated balances.'}
                {tab === 'Budgets & goals' && 'Monthly category budget limits and dedicated savings targets.'}
                {tab === 'Loans & ledger' && 'Money lent to or borrowed from relatives, friends, or lenders.'}
              </p>
            </div>
            <div className="action-group">
              <button
                className="primary"
                onClick={() => {
                  setEditingTx(null);
                  setTxAmount('');
                  setTxDescription('');
                  setTxDate(new Date().toISOString().slice(0, 16));
                  setModal('transaction');
                }}
              >
                <Plus size={17} /> Add transaction
              </button>
            </div>
          </div>

          {successMsg && (
            <div className="success-banner">
              <span><CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6 }} />{successMsg}</span>
              <button onClick={() => setSuccessMsg('')}><X size={15} /></button>
            </div>
          )}
          {error && (
            <div className="error inline-error">
              <span>{error}</span>
              <button onClick={() => setError('')}><X size={15} /></button>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: OVERVIEW                                             */}
          {/* ========================================================= */}
          {tab === 'Overview' && (
            <>
              <div className="period-row">
                <span className="period-chip">
                  <Calendar size={14} />
                  Month:
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    style={{ border: 0, padding: 0, background: 'transparent', fontWeight: 600, color: 'inherit' }}
                  />
                </span>
                <span className="muted small-text">Household Bookkeeping · Currency INR (₹)</span>
              </div>

              {/* KPI Grid */}
              <section className="kpi-grid">
                <Kpi title="Total income" value={money(summary?.total_income || 0)} icon={<ArrowDownLeft />} tone="green" foot="Earned this month" />
                <Kpi title="Total expenses" value={money(summary?.total_expenses || 0)} icon={<ArrowUpRight />} tone="rose" foot="Spent this month" />
                <Kpi title="Net savings" value={money(summary?.net_savings || 0)} icon={<Wallet />} tone="blue" foot="Income minus expenses" />
                <Kpi title="Transactions" value={String(summary?.transaction_count || 0)} icon={<ReceiptText />} tone="amber" foot="Recorded entries" />
              </section>

              {/* Charts & Analytics */}
              <section className="dashboard-grid">
                {/* Money Snapshot Donut */}
                <div className="panel chart-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Money snapshot</h2>
                      <p className="muted">Monthly earnings, outflows, and savings</p>
                    </div>
                    <span className="tag">{selectedMonth}</span>
                  </div>
                  {chartData.length ? (
                    <div className="chart-wrap">
                      <ResponsiveContainer width="54%" height="100%">
                        <PieChart>
                          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={85} paddingAngle={4}>
                            {chartData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                          </Pie>
                          <Tooltip formatter={v => money(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="chart-legend">
                        {chartData.map((d, i) => (
                          <div key={d.name}>
                            <i style={{ background: palette[i % palette.length] }} />
                            <span>{d.name}</span>
                            <b>{money(d.value)}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Empty text="No transactions recorded for this month yet." />
                  )}
                </div>

                {/* Spending by Category */}
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Spending by category</h2>
                      <p className="muted">Where your money went this month</p>
                    </div>
                    <span className="tag">EXPENSES</span>
                  </div>
                  {categoryBreakdownData.length ? (
                    <div style={{ marginTop: 14 }}>
                      {categoryBreakdownData.slice(0, 5).map((cat, idx) => (
                        <div key={cat.name} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                            <span><b>{cat.name}</b></span>
                            <span>{money(cat.value)} <small className="muted">({cat.pct}%)</small></span>
                          </div>
                          <div className="progress-bar-bg" style={{ margin: 0 }}>
                            <div
                              className="progress-bar-fill rose"
                              style={{ width: `${Math.min(100, cat.pct)}%`, background: palette[idx % palette.length] }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty text="No categorized expenses recorded for this month." />
                  )}
                </div>
              </section>

              {/* Accounts Real-Time Balances */}
              <section className="panel" style={{ marginTop: 15 }}>
                <div className="panel-head">
                  <div>
                    <h2>Account balances</h2>
                    <p className="muted">Real-time balances calculated from opening balances and transactions</p>
                  </div>
                  <button className="link-button" onClick={() => setTab('Accounts')}>Manage accounts →</button>
                </div>
                <div className="card-grid" style={{ marginTop: 12 }}>
                  {accounts.map(acc => (
                    <div key={acc.id} className="item-card" style={{ padding: 14 }}>
                      <div className="item-card-head" style={{ marginBottom: 6 }}>
                        <div>
                          <b style={{ fontSize: 12 }}>{acc.name}</b>
                          <small style={{ display: 'block' }}>{acc.account_type.toUpperCase()}</small>
                        </div>
                        <span className="badge badge-green">Active</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 10, color: '#829188' }}>Current balance</span>
                        <strong style={{ display: 'block', fontSize: 18, color: '#1f3528' }}>{money(acc.current_balance)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recent Transactions Table */}
              <section className="panel transactions-panel">
                <div className="panel-head">
                  <div>
                    <h2>Recent transactions</h2>
                    <p className="muted">Latest income and expense entries</p>
                  </div>
                  <button className="link-button" onClick={() => setTab('Transactions')}>View all ({transactions.length}) →</button>
                </div>
                <TransactionTable
                  transactions={transactions.slice(0, 6)}
                  onEdit={openEditTxModal}
                  onDelete={removeTransaction}
                />
              </section>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB: TRANSACTIONS                                         */}
          {/* ========================================================= */}
          {tab === 'Transactions' && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>All transactions</h2>
                  <p className="muted">Filter by type, family member, category, or keyword, and export reports.</p>
                </div>
                <div className="action-group">
                  <a
                    href={api.exportCsvUrl(selectedMonth)}
                    download
                    className="secondary btn-sm"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Download size={14} /> Export CSV
                  </a>
                  <button
                    className="primary btn-sm"
                    onClick={() => {
                      setEditingTx(null);
                      setTxAmount('');
                      setTxDescription('');
                      setTxDate(new Date().toISOString().slice(0, 16));
                      setModal('transaction');
                    }}
                  >
                    <Plus size={14} /> Add transaction
                  </button>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="filter-bar">
                <div className="search-input" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Search size={14} color="#829188" />
                  <input
                    type="text"
                    placeholder="Search by description..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ border: 0, padding: 0, width: '100%' }}
                  />
                </div>

                <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>

                <select value={filterMember} onChange={e => setFilterMember(e.target.value)}>
                  <option value="">All Family Members</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>

                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  title="Filter by month"
                />

                {(searchQuery || filterType || filterMember || filterCategory) && (
                  <button
                    className="secondary btn-sm"
                    onClick={() => { setSearchQuery(''); setFilterType(''); setFilterMember(''); setFilterCategory(''); }}
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {/* Transactions Table */}
              <TransactionTable
                transactions={transactions}
                onEdit={openEditTxModal}
                onDelete={removeTransaction}
              />
            </section>
          )}

          {/* ========================================================= */}
          {/* TAB: FAMILY MEMBERS                                       */}
          {/* ========================================================= */}
          {tab === 'Family members' && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Family members</h2>
                  <p className="muted">Bookkeeping profiles associated with your household.</p>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setEditingMember(null);
                    setMemberName('');
                    setMemberRelation('Spouse');
                    setModal('member');
                  }}
                >
                  <Plus size={16} /> Add member
                </button>
              </div>

              <div className="member-list">
                {members.map(m => (
                  <div className="member-row" key={m.id}>
                    <span className="avatar">{m.name.slice(0, 1).toUpperCase()}</span>
                    <div className="member-info">
                      <b>{m.name}</b>
                      <small>{m.relationship_label} · {m.is_active ? 'Active profile' : 'Inactive'}</small>
                    </div>
                    <div className="action-group">
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditingMember(m);
                          setMemberName(m.name);
                          setMemberRelation(m.relationship_label);
                          setModal('member');
                        }}
                      >
                        Edit
                      </button>
                      {m.is_active && (
                        <button className="danger-ghost" onClick={() => removeMember(m)}>Deactivate</button>
                      )}
                    </div>
                  </div>
                ))}
                {!members.length && <Empty text="No family members registered yet." />}
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* TAB: ACCOUNTS                                             */}
          {/* ========================================================= */}
          {tab === 'Accounts' && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Household accounts</h2>
                  <p className="muted">Bank accounts, cash, digital wallets, and cards with live calculated balances.</p>
                </div>
                <button className="primary" onClick={() => { setAccName(''); setAccOpening('0.00'); setModal('account'); }}>
                  <Plus size={16} /> Add account
                </button>
              </div>

              <div className="card-grid">
                {accounts.map(acc => (
                  <div key={acc.id} className="item-card">
                    <div className="item-card-head">
                      <div>
                        <h3>{acc.name}</h3>
                        <small>{acc.account_type.toUpperCase()}</small>
                      </div>
                      <span className="badge badge-green">Active</span>
                    </div>
                    <div>
                      <div className="card-stats">
                        <span>Opening balance</span>
                        <span>{money(acc.opening_balance)}</span>
                      </div>
                      <div className="card-stats" style={{ marginTop: 8, borderTop: '1px solid #edf0ed', paddingTop: 8 }}>
                        <span><b>Live balance</b></span>
                        <b style={{ fontSize: 16, color: Number(acc.current_balance) < 0 ? '#b84f5c' : '#237549' }}>
                          {money(acc.current_balance)}
                        </b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* TAB: BUDGETS & SAVINGS GOALS                              */}
          {/* ========================================================= */}
          {tab === 'Budgets & goals' && (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Budgets Section */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Monthly category budgets</h2>
                    <p className="muted">Set limits on spending categories to prevent overspending.</p>
                  </div>
                  <button className="primary" onClick={() => { setBudgetName(''); setBudgetLimit(''); setModal('budget'); }}>
                    <Plus size={16} /> Set budget
                  </button>
                </div>

                <div className="card-grid">
                  {budgets.map(b => {
                    const limit = Number(b.monthly_limit);
                    const spent = Number(b.spent_amount);
                    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                    const tone = pct > 100 ? 'rose' : pct > 80 ? 'amber' : 'green';

                    return (
                      <div key={b.id} className="item-card">
                        <div className="item-card-head">
                          <div>
                            <h3>{b.name}</h3>
                            <small>{b.category_name}</small>
                          </div>
                          <span className={`badge badge-${tone}`}>
                            {pct > 100 ? 'Over limit' : `${pct}% spent`}
                          </span>
                        </div>
                        <div>
                          <div className="progress-bar-bg">
                            <div className={`progress-bar-fill ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <div className="card-stats">
                            <span>Spent: <b>{money(spent)}</b></span>
                            <span>Limit: <b>{money(limit)}</b></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                            <button className="btn-icon danger" onClick={() => removeBudget(b.id)} title="Delete budget">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!budgets.length && <Empty text="No budgets defined yet. Create your first budget limit." />}
              </section>

              {/* Savings Goals Section */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Dedicated savings goals</h2>
                    <p className="muted">Track progress towards vacations, emergency funds, or family milestones.</p>
                  </div>
                  <button className="primary" onClick={() => { setGoalName(''); setGoalTarget(''); setGoalNotes(''); setModal('goal'); }}>
                    <Plus size={16} /> New goal
                  </button>
                </div>

                <div className="card-grid">
                  {savingsGoals.map(g => {
                    const target = Number(g.target_amount);
                    const current = Number(g.current_amount);
                    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

                    return (
                      <div key={g.id} className="item-card">
                        <div className="item-card-head">
                          <div>
                            <h3>{g.name}</h3>
                            <small>{g.notes || 'No description'}</small>
                          </div>
                          <span className={`badge ${g.is_completed ? 'badge-green' : 'badge-blue'}`}>
                            {g.is_completed ? 'Achieved' : `${pct}% saved`}
                          </span>
                        </div>
                        <div>
                          <div className="progress-bar-bg">
                            <div className="progress-bar-fill green" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="card-stats">
                            <span>Saved: <b>{money(current)}</b></span>
                            <span>Target: <b>{money(target)}</b></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                            <button
                              className="secondary btn-sm"
                              onClick={() => { setSelectedGoal(g); setGoalContribAmount(''); setModal('goal_contribute'); }}
                            >
                              <Plus size={13} style={{ display: 'inline', marginRight: 4 }} /> Add funds
                            </button>
                            <button className="btn-icon danger" onClick={() => removeGoal(g.id)} title="Delete goal">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!savingsGoals.length && <Empty text="No savings goals created yet. Plan your first milestone." />}
              </section>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: LOANS & BORROWING LEDGER                             */}
          {/* ========================================================= */}
          {tab === 'Loans & ledger' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <section className="kpi-grid">
                <Kpi title="Money lent out" value={money(totalLentRemaining)} icon={<ArrowUpRight />} tone="amber" foot="Pending to receive" />
                <Kpi title="Money borrowed" value={money(totalBorrowedRemaining)} icon={<ArrowDownLeft />} tone="rose" foot="Pending to repay" />
                <Kpi title="Active loans" value={String(loans.filter(l => !l.is_settled).length)} icon={<Activity />} tone="blue" foot="Unsettled records" />
                <Kpi title="Settled loans" value={String(loans.filter(l => l.is_settled).length)} icon={<CheckCircle2 />} tone="green" foot="Fully repaid" />
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Loans & borrowings ledger</h2>
                    <p className="muted">Track personal loans, family lending, and repayments with clear audit history.</p>
                  </div>
                  <button className="primary" onClick={() => { setLoanPerson(''); setLoanPrincipal(''); setLoanDesc(''); setModal('loan'); }}>
                    <Plus size={16} /> Record loan
                  </button>
                </div>

                <div className="card-grid">
                  {loans.map(l => (
                    <div key={l.id} className="item-card">
                      <div className="item-card-head">
                        <div>
                          <h3>{l.person_name}</h3>
                          <small>{l.description || (l.loan_type === 'lent' ? 'Money lent' : 'Money borrowed')}</small>
                        </div>
                        <span className={`badge ${l.is_settled ? 'badge-green' : l.loan_type === 'lent' ? 'badge-amber' : 'badge-rose'}`}>
                          {l.is_settled ? 'Settled' : l.loan_type === 'lent' ? 'You lent' : 'You borrowed'}
                        </span>
                      </div>
                      <div>
                        <div className="card-stats">
                          <span>Principal</span>
                          <b>{money(l.principal_amount)}</b>
                        </div>
                        <div className="card-stats">
                          <span>Repaid so far</span>
                          <span>{money(l.repaid_amount)}</span>
                        </div>
                        <div className="card-stats" style={{ marginTop: 6, borderTop: '1px solid #edf0ed', paddingTop: 6 }}>
                          <span><b>Remaining balance</b></span>
                          <b style={{ color: l.is_settled ? '#237549' : '#b84f5c' }}>{money(l.remaining_amount)}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                          {!l.is_settled ? (
                            <button
                              className="secondary btn-sm"
                              onClick={() => { setSelectedLoan(l); setLoanRepayAmount(''); setModal('loan_repay'); }}
                            >
                              Record repayment
                            </button>
                          ) : (
                            <span className="badge badge-green">Closed</span>
                          )}
                          <button className="btn-icon danger" onClick={() => removeLoan(l.id)} title="Delete loan">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {!loans.length && <Empty text="No loans or borrowings recorded. Keep your lending ledger organized here." />}
              </section>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* MODALS                                                    */}
      {/* ========================================================= */}
      {modal && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <section className="modal">
            {/* Modal Header */}
            <div className="modal-head">
              <h2>
                {modal === 'transaction' && 'Add Transaction'}
                {modal === 'edit_transaction' && 'Edit Transaction'}
                {modal === 'member' && (editingMember ? 'Edit Family Member' : 'Add Family Member')}
                {modal === 'account' && 'Create Account'}
                {modal === 'budget' && 'Set Category Budget'}
                {modal === 'goal' && 'Create Savings Goal'}
                {modal === 'goal_contribute' && `Add Funds: ${selectedGoal?.name}`}
                {modal === 'loan' && 'Record Loan / Borrowing'}
                {modal === 'loan_repay' && `Record Repayment: ${selectedLoan?.person_name}`}
              </h2>
              <button className="icon-button" onClick={() => setModal(null)}><X /></button>
            </div>

            {/* Modal Form: Add or Edit Transaction */}
            {(modal === 'transaction' || modal === 'edit_transaction') && (
              <form className="form-stack" onSubmit={saveTransaction}>
                <div className="type-toggle">
                  <button
                    type="button"
                    className={txType === 'expense' ? 'selected expense' : ''}
                    onClick={() => setTxType('expense')}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    className={txType === 'income' ? 'selected income' : ''}
                    onClick={() => setTxType('income')}
                  >
                    Income
                  </button>
                </div>

                <label>
                  Amount (₹)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={txAmount}
                    onChange={e => setTxAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Description
                  <input
                    required
                    minLength={2}
                    value={txDescription}
                    onChange={e => setTxDescription(e.target.value)}
                    placeholder="e.g. Grocery store, Electricity bill, Salary"
                  />
                </label>

                <label>
                  Account
                  <select required value={txAccount} onChange={e => setTxAccount(e.target.value)}>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({money(a.current_balance)})</option>)}
                  </select>
                </label>

                <label>
                  Family Member
                  <select value={txMember} onChange={e => setTxMember(e.target.value)}>
                    <option value="">Household / Shared</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.relationship_label})</option>)}
                  </select>
                </label>

                <label>
                  Category
                  <select value={txCategory} onChange={e => setTxCategory(e.target.value)}>
                    <option value="">Uncategorized</option>
                    {categories
                      .filter(c => c.transaction_type === txType)
                      .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>

                <label>
                  Date & Time
                  <input
                    type="datetime-local"
                    required
                    value={txDate}
                    onChange={e => setTxDate(e.target.value)}
                  />
                </label>

                <button className="primary full" disabled={busy || !accounts.length}>
                  {busy ? 'Saving…' : modal === 'edit_transaction' ? 'Update transaction' : 'Record transaction'}
                </button>
              </form>
            )}

            {/* Modal Form: Member */}
            {modal === 'member' && (
              <form className="form-stack" onSubmit={saveMember}>
                <label>
                  Member name
                  <input required minLength={2} value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="e.g. Aditi" />
                </label>
                <label>
                  Relationship
                  <select value={memberRelation} onChange={e => setMemberRelation(e.target.value)}>
                    {['Self', 'Spouse', 'Child', 'Parent', 'Sibling', 'Other'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Save family member'}
                </button>
              </form>
            )}

            {/* Modal Form: Account */}
            {modal === 'account' && (
              <form className="form-stack" onSubmit={saveAccount}>
                <label>
                  Account name
                  <input required minLength={2} value={accName} onChange={e => setAccName(e.target.value)} placeholder="e.g. HDFC Bank, ICICI Salary, Paytm" />
                </label>
                <label>
                  Account type
                  <select value={accType} onChange={e => setAccType(e.target.value)}>
                    <option value="bank">Bank Account</option>
                    <option value="cash">Cash in Hand</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="wallet">Digital Wallet / UPI</option>
                    <option value="investment">Investment / Brokerage</option>
                  </select>
                </label>
                <label>
                  Opening balance (₹)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={accOpening}
                    onChange={e => setAccOpening(e.target.value)}
                    placeholder="0.00"
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Create account'}
                </button>
              </form>
            )}

            {/* Modal Form: Budget */}
            {modal === 'budget' && (
              <form className="form-stack" onSubmit={saveBudget}>
                <label>
                  Budget name
                  <input required minLength={2} value={budgetName} onChange={e => setBudgetName(e.target.value)} placeholder="e.g. Monthly Groceries" />
                </label>
                <label>
                  Category
                  <select value={budgetCategory} onChange={e => setBudgetCategory(e.target.value)}>
                    <option value="">All Categories</option>
                    {categories.filter(c => c.transaction_type === 'expense').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label>
                  Monthly limit (₹)
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={budgetLimit}
                    onChange={e => setBudgetLimit(e.target.value)}
                    placeholder="20000.00"
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Set budget'}
                </button>
              </form>
            )}

            {/* Modal Form: Savings Goal */}
            {modal === 'goal' && (
              <form className="form-stack" onSubmit={saveGoal}>
                <label>
                  Goal title
                  <input required minLength={2} value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="e.g. Emergency Fund, New Car" />
                </label>
                <label>
                  Target amount (₹)
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={goalTarget}
                    onChange={e => setGoalTarget(e.target.value)}
                    placeholder="100000.00"
                  />
                </label>
                <label>
                  Starting amount (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goalInitial}
                    onChange={e => setGoalInitial(e.target.value)}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  Notes / Details
                  <input value={goalNotes} onChange={e => setGoalNotes(e.target.value)} placeholder="e.g. Target date: Diwali 2026" />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Create goal'}
                </button>
              </form>
            )}

            {/* Modal Form: Goal Contribution */}
            {modal === 'goal_contribute' && (
              <form className="form-stack" onSubmit={saveGoalContribution}>
                <p className="muted" style={{ margin: 0 }}>
                  Current progress: {money(selectedGoal?.current_amount || 0)} of {money(selectedGoal?.target_amount || 0)}
                </p>
                <label>
                  Contribution amount (₹)
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={goalContribAmount}
                    onChange={e => setGoalContribAmount(e.target.value)}
                    placeholder="5000.00"
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Deposit funds'}
                </button>
              </form>
            )}

            {/* Modal Form: Loan */}
            {modal === 'loan' && (
              <form className="form-stack" onSubmit={saveLoan}>
                <label>
                  Person / Entity
                  <input required minLength={2} value={loanPerson} onChange={e => setLoanPerson(e.target.value)} placeholder="e.g. Rajesh, Uncle Suresh, Bank" />
                </label>
                <label>
                  Type
                  <select value={loanType} onChange={e => setLoanType(e.target.value as 'lent' | 'borrowed')}>
                    <option value="lent">Money Lent (They owe you)</option>
                    <option value="borrowed">Money Borrowed (You owe them)</option>
                  </select>
                </label>
                <label>
                  Principal amount (₹)
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={loanPrincipal}
                    onChange={e => setLoanPrincipal(e.target.value)}
                    placeholder="25000.00"
                  />
                </label>
                <label>
                  Notes / Purpose
                  <input value={loanDesc} onChange={e => setLoanDesc(e.target.value)} placeholder="e.g. Loan for home renovation" />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Save loan record'}
                </button>
              </form>
            )}

            {/* Modal Form: Loan Repayment */}
            {modal === 'loan_repay' && (
              <form className="form-stack" onSubmit={saveLoanRepayment}>
                <p className="muted" style={{ margin: 0 }}>
                  Remaining balance: {money(selectedLoan?.remaining_amount || 0)}
                </p>
                <label>
                  Repayment amount (₹)
                  <input
                    required
                    type="number"
                    min="1"
                    max={Number(selectedLoan?.remaining_amount || 10000000)}
                    step="0.01"
                    value={loanRepayAmount}
                    onChange={e => setLoanRepayAmount(e.target.value)}
                    placeholder="5000.00"
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Confirm repayment'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Component: KPI Card
// -------------------------------------------------------------
function Kpi({ title, value, icon, tone, foot }: { title: string; value: string; icon: React.ReactNode; tone: string; foot: string }) {
  return (
    <article className="kpi-card">
      <div className="kpi-top">
        <span>{title}</span>
        <i className={`kpi-icon ${tone}`}>{icon}</i>
      </div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </article>
  );
}

// -------------------------------------------------------------
// Component: Empty State
// -------------------------------------------------------------
function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><ReceiptText /></div>
      <p>{text}</p>
    </div>
  );
}

// -------------------------------------------------------------
// Component: Transaction Table with Actions
// -------------------------------------------------------------
function TransactionTable({
  transactions,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  if (!transactions.length) {
    return <Empty text="No transactions match your criteria." />;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>DESCRIPTION</th>
            <th>DATE</th>
            <th>CATEGORY</th>
            <th>MEMBER</th>
            <th>ACCOUNT</th>
            <th>TYPE</th>
            <th className="right">AMOUNT</th>
            <th className="right">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(t => (
            <tr key={t.id}>
              <td>
                <div className="tx-name">
                  <span className={`tx-dot ${t.transaction_type}`}>
                    {t.transaction_type === 'income' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                  </span>
                  <b>{t.description}</b>
                </div>
              </td>
              <td>{new Date(t.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td><span className="category-pill">{t.category_name || 'Uncategorized'}</span></td>
              <td><span className="member-pill">{t.member_name || 'Household'}</span></td>
              <td><small>{t.account_name || 'Account'}</small></td>
              <td><span className={`status ${t.transaction_type}`}>{t.transaction_type}</span></td>
              <td className={`right amount ${t.transaction_type}`}>
                {t.transaction_type === 'income' ? '+' : '−'}{money(t.amount)}
              </td>
              <td className="right">
                <div className="tx-actions">
                  <button className="btn-icon" onClick={() => onEdit(t)} title="Edit transaction"><Edit2 size={13} /></button>
                  <button className="btn-icon danger" onClick={() => onDelete(t)} title="Delete transaction"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
