import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, BookOpen,
  Calendar, CheckCircle2, ChevronDown, CreditCard, Download, Edit2,
  LayoutDashboard, LogOut, Menu, Plus, Printer, ReceiptText, Search,
  ShieldCheck, Target, Trash2, Users, Wallet, X
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  api, type Account, type AccountStatement, type Budget, type Category,
  type Member, type Loan, type SavingsGoal, type Summary, type Transaction,
  type UserMe, type AuditLog
} from './api';

const money = (value: number | string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));

const palette = ['#2f8f67', '#e5a64b', '#7b8fe8', '#d77d83', '#8854d0', '#20bf6b', '#fa8231', '#4b6584'];

const FINANCIAL_TIPS = [
  "Tip: Tracking small daily expenses saves up to 15% monthly on family spending!",
  "Tip: Internal fund transfers between accounts don't count as expenses — keeping your analytics accurate.",
  "Tip: Admin can add family members with their email so they can sign in and track individual balances.",
  "Tip: Assigning accounts to specific family members gives transparent individual and combined balances.",
  "Tip: Setting monthly category budgets alerts you before overspending happens.",
  "Tip: Repayments on family loans automatically credit the chosen account and family member."
];

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('ff360_access_token'));
  const [userProfile, setUserProfile] = useState<UserMe | null>(null);

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

  // Interactive greeting tip index
  const [greetingTipIndex, setGreetingTipIndex] = useState(0);

  // Bank Statement / Ledger states
  const [statementAccount, setStatementAccount] = useState<string>('');
  const [statementFromDate, setStatementFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [statementToDate, setStatementToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [statementData, setStatementData] = useState<AccountStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  // Filtering states for Transactions
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterMember, setFilterMember] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Modals
  type ModalType =
    | 'transaction'
    | 'edit_transaction'
    | 'transfer'
    | 'member'
    | 'edit_member'
    | 'reset_password'
    | 'account'
    | 'edit_account'
    | 'budget'
    | 'goal'
    | 'goal_contribute'
    | 'loan'
    | 'loan_repay'
    | null;
  const [modal, setModal] = useState<ModalType>(null);

  // Targets
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  // Transaction form states
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txAccount, setTxAccount] = useState('');
  const [txMember, setTxMember] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 16));

  // Transfer form states
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferMember, setTransferMember] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 16));

  // Member form states (Enhanced for Sign-in & Accounts)
  const [memberName, setMemberName] = useState('');
  const [memberRelation, setMemberRelation] = useState('Other');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'member'>('member');
  const [memberInitialPass, setMemberInitialPass] = useState('');
  const [memberCreateAcc, setMemberCreateAcc] = useState(false);
  const [memberInitialAccName, setMemberInitialAccName] = useState('');
  const [memberInitialAccType, setMemberInitialAccType] = useState('bank');
  const [memberInitialAccBalance, setMemberInitialAccBalance] = useState('0.00');

  // Password Reset for Member
  const [resetTargetMember, setResetTargetMember] = useState<Member | null>(null);
  const [resetNewPass, setResetNewPass] = useState('');

  // Account form states (Enhanced with Member ownership)
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('bank');
  const [accOpening, setAccOpening] = useState('0.00');
  const [accOwnerMember, setAccOwnerMember] = useState('');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Admin household settings & audit logs
  const [householdEditName, setHouseholdEditName] = useState('');
  const [householdEditCurrency, setHouseholdEditCurrency] = useState('INR');
  const [auditLogsList, setAuditLogsList] = useState<AuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Budget & Goal form states
  const [budgetName, setBudgetName] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalInitial, setGoalInitial] = useState('0.00');
  const [goalNotes, setGoalNotes] = useState('');
  const [goalContribAmount, setGoalContribAmount] = useState('');

  // Loan form states (with Account and Member choice)
  const [loanPerson, setLoanPerson] = useState('');
  const [loanType, setLoanType] = useState<'lent' | 'borrowed'>('lent');
  const [loanPrincipal, setLoanPrincipal] = useState('');
  const [loanAccount, setLoanAccount] = useState('');
  const [loanMember, setLoanMember] = useState('');
  const [loanDesc, setLoanDesc] = useState('');
  const [loanRepayAmount, setLoanRepayAmount] = useState('');
  const [loanRepayAccount, setLoanRepayAccount] = useState('');
  const [loanRepayMember, setLoanRepayMember] = useState('');
  const [loanRepayNotes, setLoanRepayNotes] = useState('');

  // Status
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  function notifySuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
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

      // Defaults
      if (!txAccount && a.length) setTxAccount(a[0].id);
      if (!statementAccount && a.length) setStatementAccount(a[0].id);
      if (!transferFrom && a.length) setTransferFrom(a[0].id);
      if (!transferTo && a.length > 1) setTransferTo(a[1].id);
      if (!loanAccount && a.length) setLoanAccount(a[0].id);
      if (!loanRepayAccount && a.length) setLoanRepayAccount(a[0].id);
      if (!txMember && m.length) setTxMember(m[0].id);
      if (!loanMember && m.length) setLoanMember(m[0].id);
      if (!loanRepayMember && m.length) setLoanRepayMember(m[0].id);

      await fetchFilteredTransactions();

      try {
        const p = await api.me();
        setUserProfile(p);
        if (p) {
          setHouseholdEditName(p.household_name);
          setHouseholdEditCurrency(p.currency);
        }
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

  async function fetchStatement() {
    if (!statementAccount || !statementFromDate || !statementToDate) return;
    setStatementLoading(true);
    try {
      const stmt = await api.getAccountStatement(statementAccount, statementFromDate, statementToDate);
      setStatementData(stmt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load account statement');
    } finally {
      setStatementLoading(false);
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

  useEffect(() => {
    if (token && tab === 'Bank Statement' && statementAccount) {
      fetchStatement();
    }
  }, [tab, statementAccount, statementFromDate, statementToDate]);

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
      notifySuccess(registerMode ? 'Household created successfully!' : 'Signed in securely!');
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

  // 1. Transaction Save (Checking balance beforehand for expenses)
  async function saveTransaction(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    // Pre-check for non-negative balance
    if (txType === 'expense') {
      const acc = accounts.find(a => a.id === txAccount);
      if (acc && Number(acc.current_balance) < Number(txAmount)) {
        setError(`Account balance cannot be negative. "${acc.name}" only has available balance ${money(acc.current_balance)}, cannot debit ${money(txAmount)}.`);
        setBusy(false);
        return;
      }
    }

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
      if (tab === 'Bank Statement') fetchStatement();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save transaction');
    } finally {
      setBusy(false);
    }
  }

  // 2. Fund Transfer between accounts
  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (transferFrom === transferTo) {
      setError('Source and destination accounts must be different.');
      return;
    }
    const sourceAcc = accounts.find(a => a.id === transferFrom);
    if (sourceAcc && Number(sourceAcc.current_balance) < Number(transferAmount)) {
      setError(`Insufficient balance in "${sourceAcc.name}". Available: ${money(sourceAcc.current_balance)}, required: ${money(transferAmount)}. Transaction cannot be done.`);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await api.transferFunds({
        from_account_id: transferFrom,
        to_account_id: transferTo,
        amount: transferAmount,
        description: transferDesc.trim() || 'Account Transfer',
        transaction_date: new Date(transferDate).toISOString(),
        member_id: transferMember || null,
      });
      notifySuccess(res.message);
      setModal(null);
      setTransferAmount('');
      setTransferDesc('');
      await refresh();
      if (tab === 'Bank Statement') fetchStatement();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setBusy(false);
    }
  }

  // 3. Loan Creation (with Account debit / credit and Member attribution)
  async function saveLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!loanAccount) {
      setError('Please select an account for this loan.');
      return;
    }

    // If lent, verify balance is available
    if (loanType === 'lent') {
      const acc = accounts.find(a => a.id === loanAccount);
      if (acc && Number(acc.current_balance) < Number(loanPrincipal)) {
        setError(`Cannot lend ${money(loanPrincipal)}. Account "${acc.name}" only has available balance ${money(acc.current_balance)}.`);
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      await api.addLoan({
        person_name: loanPerson.trim(),
        loan_type: loanType,
        principal_amount: loanPrincipal,
        account_id: loanAccount,
        member_id: loanMember || null,
        description: loanDesc.trim() || undefined,
      });
      const selectedAccObj = accounts.find(a => a.id === loanAccount);
      const memberObj = members.find(m => m.id === loanMember);
      notifySuccess(
        loanType === 'lent'
          ? `Loan recorded to ${loanPerson.trim()}. Debited ${money(loanPrincipal)} from ${selectedAccObj?.name || 'account'} (${memberObj?.name || 'Family'}).`
          : `Loan received from ${loanPerson.trim()}. Credited ${money(loanPrincipal)} to ${selectedAccObj?.name || 'account'}.`
      );
      setModal(null);
      setLoanPerson('');
      setLoanPrincipal('');
      setLoanDesc('');
      await refresh();
      if (tab === 'Bank Statement') fetchStatement();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record loan');
    } finally {
      setBusy(false);
    }
  }

  // 4. Loan Repayment (Credited to member/account of choice)
  async function saveLoanRepayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLoan || !loanRepayAccount) return;

    if (selectedLoan.loan_type === 'borrowed') {
      const acc = accounts.find(a => a.id === loanRepayAccount);
      if (acc && Number(acc.current_balance) < Number(loanRepayAmount)) {
        setError(`Insufficient balance. Account "${acc.name}" only has ${money(acc.current_balance)}, cannot repay ${money(loanRepayAmount)}.`);
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      await api.recordLoanRepayment(selectedLoan.id, {
        amount: loanRepayAmount,
        account_id: loanRepayAccount,
        member_id: loanRepayMember || null,
        notes: loanRepayNotes.trim() || undefined,
      });
      const accObj = accounts.find(a => a.id === loanRepayAccount);
      const memObj = members.find(m => m.id === loanRepayMember);
      notifySuccess(
        selectedLoan.loan_type === 'lent'
          ? `Repayment of ${money(loanRepayAmount)} received from ${selectedLoan.person_name} and credited to ${accObj?.name || 'account'}${memObj ? ` for ${memObj.name}` : ''}.`
          : `Repayment of ${money(loanRepayAmount)} debited from ${accObj?.name || 'account'} for loan from ${selectedLoan.person_name}.`
      );
      setModal(null);
      setSelectedLoan(null);
      setLoanRepayAmount('');
      setLoanRepayNotes('');
      await refresh();
      if (tab === 'Bank Statement') fetchStatement();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record repayment');
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
      if (tab === 'Bank Statement') fetchStatement();
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

  // Quick Date Range Helpers for Statement
  function setStatementRange(range: 'this_month' | 'last_month' | 'last_30_days') {
    const today = new Date();
    if (range === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStatementFromDate(start.toISOString().slice(0, 10));
      setStatementToDate(today.toISOString().slice(0, 10));
    } else if (range === 'last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setStatementFromDate(start.toISOString().slice(0, 10));
      setStatementToDate(end.toISOString().slice(0, 10));
    } else if (range === 'last_30_days') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setStatementFromDate(start.toISOString().slice(0, 10));
      setStatementToDate(today.toISOString().slice(0, 10));
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

  const greetingInfo = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { title: 'Good morning', icon: '🌅', sub: 'Wishing you and your family a bright and prosperous day.' };
    }
    if (hour >= 12 && hour < 17) {
      return { title: 'Good afternoon', icon: '☀️', sub: 'Hope your day is productive. Here is your midday family financial snapshot.' };
    }
    if (hour >= 17 && hour < 21) {
      return { title: 'Good evening', icon: '🌇', sub: 'Review today’s financial movements and family transactions.' };
    }
    return { title: 'Good night', icon: '🌙', sub: 'All accounts are balanced and secured. Sleep well!' };
  }, []);

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-mark"><Wallet size={25} /></div>
          <p className="eyebrow">YOUR HOUSEHOLD, IN BALANCE</p>
          <h1>Family Finance <span>360</span></h1>
          <p className="muted">Mobile-first household ledger, bank statements, fund transfers & loan tracking in INR (₹).</p>
          
          {!registerMode ? (
            <div style={{ background: '#eaf4ee', border: '1px solid #c7e5d2', borderRadius: 8, padding: '9px 12px', fontSize: 11, color: '#1f5b3a', margin: '8px 0 16px', textAlign: 'left', lineHeight: 1.4 }}>
              💡 <b>Family Member Login:</b> If your Family Admin added your email to the household, enter that email and password to log in.
            </div>
          ) : (
            <div style={{ background: '#fef7e7', border: '1px solid #f6deb3', borderRadius: 8, padding: '9px 12px', fontSize: 11, color: '#7a4e09', margin: '8px 0 16px', textAlign: 'left', lineHeight: 1.4 }}>
              👑 <b>Admin Registration:</b> Creating a new household workspace. (Invited family members should use "Sign in" instead).
            </div>
          )}

          <form onSubmit={authenticate} className="form-stack">
            {registerMode && (
              <>
                <label>
                  Your full name
                  <input required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Prabodh Kumar" />
                </label>
                <label>
                  Family / Household name
                  <input required value={household} onChange={e => setHousehold(e.target.value)} placeholder="e.g. Kumar Household" />
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
                minLength={registerMode ? 6 : 1}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={registerMode ? 'At least 6 characters' : 'Your password'}
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="primary full" disabled={busy}>
              {busy ? 'Please wait…' : registerMode ? 'Create household workspace' : 'Sign in securely'}
            </button>
          </form>
          <button className="text-button" onClick={() => { setRegisterMode(!registerMode); setError(''); }}>
            {registerMode ? 'Already registered or invited? Sign in' : 'New family setup? Create family account'}
          </button>
          <p className="security-note"><ShieldCheck size={15} /> Argon2id encryption · Neon Cloud PostgreSQL · INR</p>
        </section>
      </main>
    );
  }

  const nav = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Bank Statement', icon: BookOpen },
    { name: 'Transactions', icon: ReceiptText },
    { name: 'Accounts & Transfers', icon: CreditCard },
    { name: 'Loans & ledger', icon: Activity },
    ...(userProfile?.role === 'admin'
      ? [{ name: '👑 Admin Console', icon: ShieldCheck }]
      : [{ name: 'Family members', icon: Users }]
    ),
    { name: 'Budgets & goals', icon: Target },
  ];

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
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

        <p className="nav-label">NAVIGATION</p>
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
              <b>Secured Bookkeeping</b>
              <small>Non-negative balances & verified ledger</small>
            </span>
          </div>
        </div>
      </aside>

      {mobileNav && <button aria-label="Close navigation" className="scrim" onClick={() => setMobileNav(false)} />}

      {/* Main Workspace Area */}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(true)}><Menu /></button>
          <div className="crumb">Workspace <span>/</span> <b>{tab}</b></div>
          <div className="top-actions">
            <span className="date-label">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <button className="icon-button" title="Alerts"><Bell size={18} /></button>
            <span className="avatar">{(userProfile?.full_name || 'U').slice(0, 1).toUpperCase()}</span>
          </div>
        </header>

        <div className="content">
          {/* Header Row */}
          <div className="page-heading">
            <div>
              <p className="eyebrow">FAMILY FINANCE PLATFORM</p>
              <h1>{tab}</h1>
              <p className="muted">
                {tab === 'Overview' && 'Complete financial pulse of your household with real-time balance calculations.'}
                {tab === 'Bank Statement' && 'Bank statement ledger with running available balance and date range selection.'}
                {tab === 'Transactions' && 'Comprehensive search, filters, categorization, and one-click CSV export.'}
                {tab === 'Accounts & Transfers' && 'Manage bank & cash accounts and transfer funds seamlessly with balance validation.'}
                {tab === 'Loans & ledger' && 'Track lending and borrowing, linked account debits, and flexible repayment crediting.'}
                {tab === 'Family members' && 'Manage profiles and track spending habits per family member.'}
                {tab === 'Budgets & goals' && 'Monthly category budget limits and dedicated savings milestone targets.'}
              </p>
            </div>
            <div className="action-group">
              <button
                className="secondary"
                onClick={() => {
                  setTransferAmount('');
                  setTransferDesc('');
                  setTransferDate(new Date().toISOString().slice(0, 16));
                  setModal('transfer');
                }}
              >
                <ArrowLeftRight size={15} /> Transfer funds
              </button>
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
                <Plus size={16} /> Add transaction
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
          {/* TAB 1: OVERVIEW                                           */}
          {/* ========================================================= */}
          {tab === 'Overview' && (
            <>
              {/* INTERACTIVE WISH NOTIFICATION & GREETING HERO */}
              <div className="greeting-hero">
                <div className="greeting-top">
                  <div>
                    <span className="greeting-time-badge">
                      {greetingInfo.icon} {greetingInfo.title} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </span>
                    <h2 className="greeting-title">
                      {greetingInfo.title}, {userProfile?.full_name?.split(' ')[0] || 'Family'}!
                    </h2>
                    <p className="greeting-sub">{greetingInfo.sub}</p>
                  </div>
                  <span className={`role-badge ${userProfile?.role === 'admin' ? 'admin' : 'member'}`} style={{ fontSize: 11, padding: '5px 12px' }}>
                    {userProfile?.role === 'admin' ? '👑 Family Admin' : '👤 Family Member'}
                  </span>
                </div>

                <div
                  className="greeting-interactive-box"
                  onClick={() => setGreetingTipIndex((greetingTipIndex + 1) % FINANCIAL_TIPS.length)}
                  title="Click to see another smart family financial tip"
                >
                  <span className="greeting-quote-text">
                    💡 <b>Daily Tip:</b> {FINANCIAL_TIPS[greetingTipIndex]}
                  </span>
                  <span className="greeting-quote-hint">Next Tip ❯</span>
                </div>

                <div className="greeting-actions">
                  <button
                    className="greeting-btn primary-light"
                    onClick={() => {
                      setEditingTx(null);
                      setTxType('expense');
                      setTxAmount('');
                      setTxDescription('');
                      setTxDate(new Date().toISOString().slice(0, 16));
                      setModal('transaction');
                    }}
                  >
                    <Plus size={14} /> Add Expense
                  </button>
                  <button
                    className="greeting-btn"
                    onClick={() => {
                      setEditingTx(null);
                      setTxType('income');
                      setTxAmount('');
                      setTxDescription('');
                      setTxDate(new Date().toISOString().slice(0, 16));
                      setModal('transaction');
                    }}
                  >
                    <ArrowDownLeft size={14} /> Add Income
                  </button>
                  <button
                    className="greeting-btn"
                    onClick={() => {
                      setTransferAmount('');
                      setTransferDesc('');
                      setTransferDate(new Date().toISOString().slice(0, 16));
                      setModal('transfer');
                    }}
                  >
                    <ArrowLeftRight size={14} /> Quick Transfer
                  </button>
                  <button
                    className="greeting-btn"
                    onClick={() => setTab('Bank Statement')}
                  >
                    <BookOpen size={14} /> Bank Statement
                  </button>
                  {userProfile?.role === 'admin' && (
                    <button
                      className="greeting-btn"
                      onClick={() => setTab('👑 Admin Console')}
                    >
                      <ShieldCheck size={14} /> Admin Controls
                    </button>
                  )}
                </div>
              </div>

              {/* COMBINED BALANCE HERO CARD */}
              <div className="combined-hero-card">
                <div className="combined-balance-main">
                  <span className="eyebrow" style={{ color: '#27704b' }}>TOTAL COMBINED HOUSEHOLD WEALTH</span>
                  <strong>{money(summary?.combined_balance || 0)}</strong>
                  <p className="muted" style={{ margin: 0, fontSize: 11 }}>
                    Real-time combined balance across all {accounts.length} family accounts
                  </p>
                  <div className="combined-sub-pills">
                    <span className="combined-pill">🏦 Banks: {money(accounts.filter(a => a.account_type === 'bank').reduce((s, a) => s + Number(a.current_balance), 0))}</span>
                    <span className="combined-pill">💵 Cash: {money(accounts.filter(a => a.account_type === 'cash').reduce((s, a) => s + Number(a.current_balance), 0))}</span>
                    <span className="combined-pill">👥 {members.length} Members</span>
                    <span className="combined-pill">📋 {summary?.transaction_count || 0} Transactions</span>
                  </div>
                </div>
                <div className="action-group">
                  <button
                    className="secondary"
                    onClick={() => {
                      setTransferAmount('');
                      setTransferDesc('');
                      setTransferDate(new Date().toISOString().slice(0, 16));
                      setModal('transfer');
                    }}
                  >
                    <ArrowLeftRight size={14} /> Transfer Funds
                  </button>
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
                    <Plus size={15} /> Add Transaction
                  </button>
                </div>
              </div>

              {/* INDIVIDUAL MEMBER BALANCES SECTION */}
              <section className="panel" style={{ marginTop: 20 }}>
                <div className="panel-head">
                  <div>
                    <h2>👨‍👩‍👧 Family Member Balances (Individual Breakdown)</h2>
                    <p className="muted">Combined family balance and individual balances per member account</p>
                  </div>
                  {userProfile?.role === 'admin' && (
                    <button
                      className="secondary"
                      onClick={() => {
                        setEditingMember(null);
                        setMemberName('');
                        setMemberRelation('Spouse');
                        setMemberEmail('');
                        setMemberRole('member');
                        setMemberInitialPass('');
                        setMemberCreateAcc(true);
                        setMemberInitialAccName('');
                        setMemberInitialAccType('bank');
                        setMemberInitialAccBalance('0.00');
                        setModal('member');
                      }}
                    >
                      <Plus size={14} /> Add Member Account
                    </button>
                  )}
                </div>
                <div className="member-balances-grid">
                  {summary?.member_balances && summary.member_balances.length > 0 ? (
                    summary.member_balances.map((mb, idx) => (
                      <div key={mb.member_id || `joint-${idx}`} className="member-card">
                        <div className="member-card-top">
                          <div className="member-card-avatar">
                            {(mb.member_name || 'F').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="member-card-meta">
                            <b>{mb.member_name}</b>
                            <small>{mb.relationship_label} {mb.email ? `· ${mb.email}` : ''}</small>
                          </div>
                          <span className={`role-badge ${mb.role === 'admin' ? 'admin' : 'member'}`}>
                            {mb.role === 'admin' ? '👑 Admin' : '👤 Member'}
                          </span>
                        </div>

                        <span style={{ fontSize: 10, color: '#88988d' }}>Individual Balance</span>
                        <span className="member-balance-val">{money(mb.total_balance)}</span>

                        <div className="member-account-list">
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#74877b', letterSpacing: '0.5px' }}>
                            ACCOUNTS ({mb.account_count})
                          </span>
                          {mb.accounts && mb.accounts.length > 0 ? (
                            mb.accounts.map(acc => (
                              <div key={acc.id} className="member-account-item">
                                <span>{acc.name} <small style={{ color: '#8c9c91' }}>({acc.account_type})</small></span>
                                <b>{money(acc.current_balance)}</b>
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: 10, color: '#9aaa9f', fontStyle: 'italic' }}>No linked accounts</span>
                          )}
                        </div>

                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                          <button
                            className={`secondary btn-sm ${filterMember === mb.member_id ? 'primary' : ''}`}
                            style={{ width: '100%', fontSize: 10 }}
                            onClick={() => {
                              if (filterMember === mb.member_id) {
                                setFilterMember('');
                              } else if (mb.member_id) {
                                setFilterMember(mb.member_id);
                                setTab('Transactions');
                              }
                            }}
                          >
                            {filterMember === mb.member_id ? '✓ Showing Activity' : 'View Transactions →'}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty text="No family member balances available yet." />
                  )}
                </div>
              </section>

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
                <span className="muted small-text">Strict Non-Negative Balance Enforcement · INR (₹)</span>
              </div>

              {/* KPI Cards */}
              <section className="kpi-grid">
                <Kpi title="Total income" value={money(summary?.total_income || 0)} icon={<ArrowDownLeft />} tone="green" foot="Earned this month" />
                <Kpi title="Total expenses" value={money(summary?.total_expenses || 0)} icon={<ArrowUpRight />} tone="rose" foot="Spent this month" />
                <Kpi title="Net savings" value={money(summary?.net_savings || 0)} icon={<Wallet />} tone="blue" foot="Income minus expenses" />
                <Kpi title="Transactions" value={String(summary?.transaction_count || 0)} icon={<ReceiptText />} tone="amber" foot="Excluding transfers" />
              </section>

              {/* Dashboard Grid */}
              <section className="dashboard-grid">
                <div className="panel chart-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Money snapshot</h2>
                      <p className="muted">Income vs expenses vs net savings</p>
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
                    <Empty text="No income or expenses recorded for this month." />
                  )}
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Expense breakdown</h2>
                      <p className="muted">By category this month</p>
                    </div>
                    <span className="tag">CATEGORIES</span>
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
                    <Empty text="No categorized expenses for this month." />
                  )}
                </div>
              </section>

              {/* Real-Time Balances */}
              <section className="panel" style={{ marginTop: 15 }}>
                <div className="panel-head">
                  <div>
                    <h2>Available account balances</h2>
                    <p className="muted">Live balances (Opening + Incomes - Expenses + Transfers In - Transfers Out)</p>
                  </div>
                  <button className="link-button" onClick={() => setTab('Bank Statement')}>View statement ledger →</button>
                </div>
                <div className="card-grid" style={{ marginTop: 12 }}>
                  {accounts.map(acc => (
                    <div key={acc.id} className="item-card" style={{ padding: 14 }}>
                      <div className="item-card-head" style={{ marginBottom: 6 }}>
                        <div>
                          <b style={{ fontSize: 12 }}>{acc.name}</b>
                          <small style={{ display: 'block' }}>{acc.account_type.toUpperCase()}</small>
                        </div>
                        <span className="badge badge-green">Available</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 10, color: '#829188' }}>Available Balance</span>
                        <strong style={{ display: 'block', fontSize: 18, color: '#1f3528' }}>{money(acc.current_balance)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recent Activity */}
              <section className="panel transactions-panel">
                <div className="panel-head">
                  <div>
                    <h2>Recent transactions</h2>
                    <p className="muted">Latest household activity</p>
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
          {/* TAB 2: BANK STATEMENT & LEDGER (NEW!)                     */}
          {/* ========================================================= */}
          {tab === 'Bank Statement' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Account statement ledger</h2>
                    <p className="muted">Official chronological bank statement with opening, debits, credits, and available running balance.</p>
                  </div>
                  <div className="action-group">
                    {statementData && (
                      <>
                        <a
                          href={api.exportStatementCsvUrl(statementAccount, statementFromDate, statementToDate)}
                          download
                          className="secondary btn-sm"
                          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <Download size={14} /> Export statement CSV
                        </a>
                        <button className="secondary btn-sm" onClick={() => window.print()} title="Print bank statement">
                          <Printer size={14} /> Print
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Date Range & Account Selector Bar */}
                <div className="filter-bar" style={{ marginTop: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600 }}>
                    Select Account:
                    <select
                      value={statementAccount}
                      onChange={e => setStatementAccount(e.target.value)}
                      style={{ fontWeight: 600 }}
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({money(a.current_balance)})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    From:
                    <input
                      type="date"
                      value={statementFromDate}
                      onChange={e => setStatementFromDate(e.target.value)}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    To:
                    <input
                      type="date"
                      value={statementToDate}
                      onChange={e => setStatementToDate(e.target.value)}
                    />
                  </label>

                  <button className="secondary btn-sm" onClick={() => setStatementRange('this_month')}>This Month</button>
                  <button className="secondary btn-sm" onClick={() => setStatementRange('last_month')}>Last Month</button>
                  <button className="secondary btn-sm" onClick={() => setStatementRange('last_30_days')}>Last 30 Days</button>
                </div>

                {/* Statement Summary Header Cards */}
                {statementData && (
                  <>
                    <div className="kpi-grid" style={{ marginTop: 18 }}>
                      <Kpi
                        title="Opening balance"
                        value={money(statementData.opening_balance)}
                        icon={<Wallet />}
                        tone="blue"
                        foot={`As of ${statementData.from_date}`}
                      />
                      <Kpi
                        title="Total credits (+)"
                        value={money(statementData.total_credits)}
                        icon={<ArrowDownLeft />}
                        tone="green"
                        foot="Total deposits / inflows"
                      />
                      <Kpi
                        title="Total debits (-)"
                        value={money(statementData.total_debits)}
                        icon={<ArrowUpRight />}
                        tone="rose"
                        foot="Total withdrawals / outflows"
                      />
                      <Kpi
                        title="Closing available balance"
                        value={money(statementData.closing_balance)}
                        icon={<CheckCircle2 />}
                        tone="green"
                        foot={`As of ${statementData.to_date}`}
                      />
                    </div>

                    {/* Chronological Statement Ledger Table */}
                    <div className="table-scroll" style={{ marginTop: 22 }}>
                      <table style={{ fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: '#f6f9f6' }}>
                            <th style={{ padding: '12px 10px' }}>DATE & TIME</th>
                            <th>PARTICULARS / DESCRIPTION</th>
                            <th>CATEGORY / REF</th>
                            <th>MEMBER</th>
                            <th className="right" style={{ color: '#b84f5c' }}>WITHDRAWAL (DEBIT ₹)</th>
                            <th className="right" style={{ color: '#237549' }}>DEPOSIT (CREDIT ₹)</th>
                            <th className="right" style={{ fontWeight: 700, color: '#183326' }}>AVAILABLE BALANCE (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Row for Opening Balance */}
                          <tr style={{ background: '#fafcfa', fontStyle: 'italic', color: '#68776e' }}>
                            <td style={{ padding: '10px' }}>{statementData.from_date} 00:00</td>
                            <td colSpan={5}><b>[OPENING BALANCE BROUGHT FORWARD]</b></td>
                            <td className="right" style={{ fontWeight: 700 }}>{money(statementData.opening_balance)}</td>
                          </tr>

                          {statementData.entries.map(e => (
                            <tr key={e.id}>
                              <td style={{ padding: '12px 10px' }}>
                                {new Date(e.transaction_date).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td>
                                <b>{e.description}</b>
                                {e.transfer_account_name && (
                                  <small style={{ display: 'block', color: '#577263' }}>
                                    ↔ Transfer with {e.transfer_account_name}
                                  </small>
                                )}
                              </td>
                              <td>
                                <span className="category-pill">{e.category_name || (e.transfer_account_name ? 'Transfer' : 'General')}</span>
                              </td>
                              <td>
                                <span className="member-pill">{e.member_name || 'Household'}</span>
                              </td>
                              <td className="right amount expense" style={{ color: Number(e.debit_amount) > 0 ? '#b84f5c' : '#a1aca5' }}>
                                {Number(e.debit_amount) > 0 ? `−${money(e.debit_amount)}` : '—'}
                              </td>
                              <td className="right amount income" style={{ color: Number(e.credit_amount) > 0 ? '#237549' : '#a1aca5' }}>
                                {Number(e.credit_amount) > 0 ? `+${money(e.credit_amount)}` : '—'}
                              </td>
                              <td className="right" style={{ fontWeight: 700, fontSize: 12, color: '#1a3627' }}>
                                {money(e.running_balance)}
                              </td>
                            </tr>
                          ))}

                          {/* Row for Closing Balance */}
                          <tr style={{ background: '#f1f7f2', fontWeight: 700, borderTop: '2px solid #236b49' }}>
                            <td style={{ padding: '12px 10px' }}>{statementData.to_date} 23:59</td>
                            <td colSpan={3}><b>[CLOSING AVAILABLE BALANCE]</b></td>
                            <td className="right amount expense">−{money(statementData.total_debits)}</td>
                            <td className="right amount income">+{money(statementData.total_credits)}</td>
                            <td className="right" style={{ fontSize: 14, color: '#236b49' }}>
                              {money(statementData.closing_balance)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {statementLoading && <p className="muted" style={{ textAlign: 'center', padding: 20 }}>Loading ledger statement…</p>}
              </section>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: TRANSACTIONS                                       */}
          {/* ========================================================= */}
          {tab === 'Transactions' && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>All transactions</h2>
                  <p className="muted">Search, filter, edit, or delete transactions.</p>
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
                  <option value="transfer">Transfer</option>
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

              <TransactionTable
                transactions={transactions}
                onEdit={openEditTxModal}
                onDelete={removeTransaction}
              />
            </section>
          )}

          {/* ========================================================= */}
          {/* TAB 4: ACCOUNTS & TRANSFERS                               */}
          {/* ========================================================= */}
          {tab === 'Accounts & Transfers' && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Household accounts</h2>
                  <p className="muted">Bank accounts, cash reserves, wallets, and instant balance-checked transfers.</p>
                </div>
                <div className="action-group">
                  <button
                    className="secondary"
                    onClick={() => {
                      setTransferAmount('');
                      setTransferDesc('');
                      setTransferDate(new Date().toISOString().slice(0, 16));
                      setModal('transfer');
                    }}
                  >
                    <ArrowLeftRight size={14} /> Transfer funds
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      setEditingAccount(null);
                      setAccName('');
                      setAccType('bank');
                      setAccOpening('0.00');
                      setAccOwnerMember('');
                      setModal('account');
                    }}
                  >
                    <Plus size={15} /> Add account
                  </button>
                </div>
              </div>

              <div className="card-grid">
                {accounts.map(acc => (
                  <div key={acc.id} className="item-card">
                    <div className="item-card-head">
                      <div>
                        <h3>{acc.name}</h3>
                        <small>{acc.account_type.toUpperCase()} · <span className="member-pill">{acc.member_name || 'Joint / Family'}</span></small>
                      </div>
                      <span className="badge badge-green">Active</span>
                    </div>
                    <div>
                      <div className="card-stats">
                        <span>Opening balance</span>
                        <span>{money(acc.opening_balance)}</span>
                      </div>
                      <div className="card-stats" style={{ marginTop: 8, borderTop: '1px solid #edf0ed', paddingTop: 8 }}>
                        <span><b>Available Balance</b></span>
                        <b style={{ fontSize: 17, color: '#237549' }}>
                          {money(acc.current_balance)}
                        </b>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                        <button
                          className="secondary btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => {
                            setStatementAccount(acc.id);
                            setTab('Bank Statement');
                          }}
                        >
                          <BookOpen size={13} style={{ display: 'inline', marginRight: 4 }} /> Statement
                        </button>
                        <button
                          className="secondary btn-sm"
                          style={{ flex: 1 }}
                          onClick={() => {
                            setTransferFrom(acc.id);
                            setTransferAmount('');
                            setModal('transfer');
                          }}
                        >
                          <ArrowLeftRight size={13} style={{ display: 'inline', marginRight: 4 }} /> Transfer
                        </button>
                      </div>
                      {userProfile?.role === 'admin' && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            className="secondary btn-sm"
                            style={{ width: '100%', fontSize: 10 }}
                            onClick={() => {
                              setEditingAccount(acc);
                              setAccName(acc.name);
                              setAccType(acc.account_type);
                              setAccOpening(String(acc.opening_balance));
                              setAccOwnerMember(acc.member_id || '');
                              setModal('edit_account');
                            }}
                          >
                            ✏️ Edit / Reassign Owner
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* TAB 5: LOANS & LEDGER                                     */}
          {/* ========================================================= */}
          {tab === 'Loans & ledger' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <section className="kpi-grid">
                <Kpi title="Money lent out" value={money(totalLentRemaining)} icon={<ArrowUpRight />} tone="amber" foot="Debited from your accounts" />
                <Kpi title="Money borrowed" value={money(totalBorrowedRemaining)} icon={<ArrowDownLeft />} tone="rose" foot="Credited to your accounts" />
                <Kpi title="Active loans" value={String(loans.filter(l => !l.is_settled).length)} icon={<Activity />} tone="blue" foot="Pending settlement" />
                <Kpi title="Settled loans" value={String(loans.filter(l => l.is_settled).length)} icon={<CheckCircle2 />} tone="green" foot="Fully repaid" />
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Loans & borrowings ledger</h2>
                    <p className="muted">
                      When lending (e.g. Prabodh lends to Avimanyu), the account is debited. When returned, funds are credited to the family member and account of your choice.
                    </p>
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
                          <small>
                            {l.loan_type === 'lent' ? `Lent by ${l.member_name || 'Household'}` : `Borrowed by ${l.member_name || 'Household'}`}
                            {l.account_name ? ` · via ${l.account_name}` : ''}
                          </small>
                        </div>
                        <span className={`badge ${l.is_settled ? 'badge-green' : l.loan_type === 'lent' ? 'badge-amber' : 'badge-rose'}`}>
                          {l.is_settled ? 'Settled' : l.loan_type === 'lent' ? 'Money Lent (Receivable)' : 'Money Borrowed (Payable)'}
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
                              onClick={() => {
                                setSelectedLoan(l);
                                setLoanRepayAmount(String(l.remaining_amount));
                                setModal('loan_repay');
                              }}
                            >
                              Record repayment
                            </button>
                          ) : (
                            <span className="badge badge-green">Settled in full</span>
                          )}
                          <button
                            className="btn-icon danger"
                            onClick={async () => {
                              if (!window.confirm(`Delete loan record for ${l.person_name}?`)) return;
                              await api.deleteLoan(l.id);
                              notifySuccess('Loan record deleted.');
                              await refresh();
                            }}
                            title="Delete loan"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {!loans.length && <Empty text="No loans recorded yet. Track peer-to-peer family lending and borrowing here." />}
              </section>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: ADMIN CONSOLE (ZERO DATABASE TOUCHING NEEDED)      */}
          {/* ========================================================= */}
          {tab === '👑 Admin Console' && (
            <div style={{ display: 'grid', gap: 20 }}>
              {/* Section 1: Household Settings */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>👑 Household Workspace Settings</h2>
                    <p className="muted">Configure family workspace details without database touching</p>
                  </div>
                  <span className="role-badge admin">👑 Full Admin Control</span>
                </div>
                <form
                  className="form-stack"
                  style={{ maxWidth: 460, marginTop: 15 }}
                  onSubmit={async e => {
                    e.preventDefault();
                    setBusy(true);
                    setError('');
                    try {
                      await api.updateHousehold({ name: householdEditName.trim(), currency: householdEditCurrency.trim() });
                      notifySuccess('Household settings updated.');
                      await refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to update household');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Family / Household Name
                    <input
                      required
                      value={householdEditName}
                      onChange={e => setHouseholdEditName(e.target.value)}
                      placeholder="e.g. Rana Family"
                    />
                  </label>
                  <label>
                    Household Currency
                    <input
                      required
                      maxLength={3}
                      value={householdEditCurrency}
                      onChange={e => setHouseholdEditCurrency(e.target.value.toUpperCase())}
                      placeholder="INR"
                    />
                  </label>
                  <button className="primary" style={{ justifySelf: 'start' }} disabled={busy}>
                    {busy ? 'Saving…' : 'Save Household Settings'}
                  </button>
                </form>
              </section>

              {/* Section 2: Family Member & Sign-In Control Center */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Family Members & Sign-In Control</h2>
                    <p className="muted">Add members with login email, assign roles, and reset passwords directly</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => {
                      setEditingMember(null);
                      setMemberName('');
                      setMemberRelation('Spouse');
                      setMemberEmail('');
                      setMemberRole('member');
                      setMemberInitialPass('');
                      setMemberCreateAcc(true);
                      setMemberInitialAccName('');
                      setMemberInitialAccType('bank');
                      setMemberInitialAccBalance('0.00');
                      setModal('member');
                    }}
                  >
                    <Plus size={15} /> Add Member & Account
                  </button>
                </div>

                <div style={{ overflowX: 'auto', marginTop: 15 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Relationship</th>
                        <th>Email (Login ID)</th>
                        <th>Role</th>
                        <th>Accounts</th>
                        <th>Balance</th>
                        <th>Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => (
                        <tr key={m.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <span className="avatar small">{(m.name || 'M').slice(0, 1).toUpperCase()}</span>
                              <b>{m.name}</b>
                            </div>
                          </td>
                          <td>{m.relationship_label}</td>
                          <td>
                            {m.email ? (
                              <span style={{ color: '#276846', fontWeight: 600 }}>{m.email}</span>
                            ) : (
                              <span className="muted" style={{ fontStyle: 'italic' }}>No email assigned</span>
                            )}
                          </td>
                          <td>
                            <span className={`role-badge ${m.role === 'admin' ? 'admin' : 'member'}`}>
                              {m.role === 'admin' ? '👑 Admin' : '👤 Member'}
                            </span>
                          </td>
                          <td>{m.account_count} accounts</td>
                          <td><b>{money(m.total_balance)}</b></td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="secondary btn-sm"
                                title="Reset Login Password"
                                onClick={() => {
                                  setResetTargetMember(m);
                                  setResetNewPass('');
                                  setModal('reset_password');
                                }}
                              >
                                🔑 Reset Pass
                              </button>
                              <button
                                className="secondary btn-sm"
                                onClick={() => {
                                  setEditingMember(m);
                                  setMemberName(m.name);
                                  setMemberRelation(m.relationship_label);
                                  setMemberEmail(m.email || '');
                                  setMemberRole(m.role || 'member');
                                  setModal('edit_member');
                                }}
                              >
                                ✏️ Edit
                              </button>
                              {m.is_active && (
                                <button
                                  className="danger-ghost btn-sm"
                                  onClick={async () => {
                                    if (!window.confirm(`Deactivate ${m.name}? Historical transactions remain safe.`)) return;
                                    await api.deleteMember(m.id);
                                    notifySuccess(`${m.name} deactivated.`);
                                    await refresh();
                                  }}
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Section 3: Account Ownership & Balances */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Account Ownership & Balances</h2>
                    <p className="muted">Reassign accounts to family members or set as shared joint accounts</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => {
                      setEditingAccount(null);
                      setAccName('');
                      setAccType('bank');
                      setAccOpening('0.00');
                      setAccOwnerMember('');
                      setModal('account');
                    }}
                  >
                    <Plus size={15} /> Add Account
                  </button>
                </div>

                <div style={{ overflowX: 'auto', marginTop: 15 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Account Name</th>
                        <th>Type</th>
                        <th>Assigned Owner</th>
                        <th>Opening Balance</th>
                        <th>Available Balance</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map(acc => (
                        <tr key={acc.id}>
                          <td><b>{acc.name}</b></td>
                          <td><span className="tag">{acc.account_type.toUpperCase()}</span></td>
                          <td>
                            <span className="member-pill">
                              {acc.member_name || 'Joint / Family'}
                            </span>
                          </td>
                          <td>{money(acc.opening_balance)}</td>
                          <td><b style={{ color: '#207248' }}>{money(acc.current_balance)}</b></td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="secondary btn-sm"
                                onClick={() => {
                                  setEditingAccount(acc);
                                  setAccName(acc.name);
                                  setAccType(acc.account_type);
                                  setAccOpening(String(acc.opening_balance));
                                  setAccOwnerMember(acc.member_id || '');
                                  setModal('edit_account');
                                }}
                              >
                                ✏️ Edit / Reassign
                              </button>
                              <button
                                className="danger-ghost btn-sm"
                                onClick={async () => {
                                  if (!window.confirm(`Deactivate account ${acc.name}?`)) return;
                                  await api.deleteAccount(acc.id);
                                  notifySuccess(`Account ${acc.name} deactivated.`);
                                  await refresh();
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Section 4: Live Household Audit Logs */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Live Household Audit Trail</h2>
                    <p className="muted">Verified logs of all administrative actions and fund operations</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={async () => {
                      setLoadingAuditLogs(true);
                      try {
                        const logs = await api.auditLogs(50);
                        setAuditLogsList(logs);
                        notifySuccess('Audit trail refreshed.');
                      } catch (err) {
                        setError('Failed to load audit logs');
                      } finally {
                        setLoadingAuditLogs(false);
                      }
                    }}
                  >
                    {loadingAuditLogs ? 'Refreshing…' : '🔄 Refresh Logs'}
                  </button>
                </div>

                <div style={{ overflowX: 'auto', marginTop: 15 }}>
                  {auditLogsList.length > 0 ? (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Actor</th>
                          <th>Action</th>
                          <th>Entity</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogsList.map(log => (
                          <tr key={log.id}>
                            <td style={{ whiteSpace: 'nowrap', fontSize: 10, color: '#77887e' }}>
                              {new Date(log.created_at).toLocaleString('en-IN')}
                            </td>
                            <td><b>{log.actor_name || 'System'}</b></td>
                            <td><span className="tag">{log.action.toUpperCase()}</span></td>
                            <td><small>{log.entity_type}</small></td>
                            <td style={{ fontSize: 11 }}>{log.details || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: '#88988e' }}>
                      <p>Click "Refresh Logs" to view verified audit events for your household.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6B: FAMILY MEMBERS (STANDARD VIEW)                    */}
          {/* ========================================================= */}
          {tab === 'Family members' && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Family members</h2>
                  <p className="muted">Bookkeeping profiles associated with your household.</p>
                </div>
                {userProfile?.role === 'admin' && (
                  <button
                    className="primary"
                    onClick={() => {
                      setEditingMember(null);
                      setMemberName('');
                      setMemberRelation('Spouse');
                      setMemberEmail('');
                      setMemberRole('member');
                      setMemberInitialPass('');
                      setMemberCreateAcc(true);
                      setMemberInitialAccName('');
                      setModal('member');
                    }}
                  >
                    <Plus size={16} /> Add member
                  </button>
                )}
              </div>

              <div className="member-list">
                {members.map(m => (
                  <div className="member-row" key={m.id}>
                    <span className="avatar">{m.name.slice(0, 1).toUpperCase()}</span>
                    <div className="member-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b>{m.name}</b>
                        <span className={`role-badge ${m.role === 'admin' ? 'admin' : 'member'}`}>
                          {m.role === 'admin' ? '👑 Admin' : '👤 Member'}
                        </span>
                      </div>
                      <small>
                        {m.relationship_label} {m.email ? `· ${m.email}` : ''} · Balance: <b>{money(m.total_balance)}</b>
                      </small>
                    </div>
                    {userProfile?.role === 'admin' && (
                      <div className="action-group">
                        <button
                          className="secondary"
                          onClick={() => {
                            setEditingMember(m);
                            setMemberName(m.name);
                            setMemberRelation(m.relationship_label);
                            setMemberEmail(m.email || '');
                            setMemberRole(m.role || 'member');
                            setModal('edit_member');
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="secondary"
                          onClick={() => {
                            setResetTargetMember(m);
                            setResetNewPass('');
                            setModal('reset_password');
                          }}
                        >
                          🔑 Password
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ========================================================= */}
          {/* TAB 7: BUDGETS & GOALS                                    */}
          {/* ========================================================= */}
          {tab === 'Budgets & goals' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Monthly category budgets</h2>
                    <p className="muted">Keep family spending on track with category limits.</p>
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
                            <button
                              className="btn-icon danger"
                              onClick={async () => {
                                if (!window.confirm('Delete this budget?')) return;
                                await api.deleteBudget(b.id);
                                notifySuccess('Budget removed.');
                                await refresh();
                              }}
                              title="Delete budget"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!budgets.length && <Empty text="No budgets configured yet." />}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Dedicated savings goals</h2>
                    <p className="muted">Track financial milestones with progress contributions.</p>
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
                            <small>{g.notes || 'No notes'}</small>
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
                            <button
                              className="btn-icon danger"
                              onClick={async () => {
                                if (!window.confirm('Delete this goal?')) return;
                                await api.deleteSavingsGoal(g.id);
                                notifySuccess('Goal removed.');
                                await refresh();
                              }}
                              title="Delete goal"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!savingsGoals.length && <Empty text="No savings goals created yet." />}
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
            <div className="modal-head">
              <h2>
                {modal === 'transaction' && 'Add Transaction'}
                {modal === 'edit_transaction' && 'Edit Transaction'}
                {modal === 'transfer' && 'Transfer Funds Between Accounts'}
                {modal === 'member' && 'Add Family Member & Account'}
                {modal === 'edit_member' && 'Edit Family Member'}
                {modal === 'reset_password' && 'Reset Member Login Password'}
                {modal === 'account' && 'Create Account'}
                {modal === 'edit_account' && 'Edit & Reassign Account'}
                {modal === 'budget' && 'Set Category Budget'}
                {modal === 'goal' && 'Create Savings Goal'}
                {modal === 'goal_contribute' && `Add Funds: ${selectedGoal?.name}`}
                {modal === 'loan' && 'Record Loan / Borrowing'}
                {modal === 'loan_repay' && `Record Repayment: ${selectedLoan?.person_name}`}
              </h2>
              <button className="icon-button" onClick={() => setModal(null)}><X /></button>
            </div>

            {/* Modal: Add or Edit Transaction */}
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
                  Account (Debited / Credited)
                  <select required value={txAccount} onChange={e => setTxAccount(e.target.value)}>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — Available: {money(a.current_balance)}
                      </option>
                    ))}
                  </select>
                </label>

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
                  {txType === 'expense' && txAccount && (
                    <small style={{ color: '#74867b' }}>
                      Balance cannot be negative. Max allowed: {money(accounts.find(a => a.id === txAccount)?.current_balance || 0)}
                    </small>
                  )}
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

            {/* Modal: Transfer Funds */}
            {modal === 'transfer' && (
              <form className="form-stack" onSubmit={handleTransfer}>
                <label>
                  From Account (Source)
                  <select required value={transferFrom} onChange={e => setTransferFrom(e.target.value)}>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — Available: {money(a.current_balance)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  To Account (Destination)
                  <select required value={transferTo} onChange={e => setTransferTo(e.target.value)}>
                    {accounts.filter(a => a.id !== transferFrom).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({money(a.current_balance)})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Transfer Amount (₹)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={transferAmount}
                    onChange={e => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <small style={{ color: '#74867b' }}>
                    Available in source: {money(accounts.find(a => a.id === transferFrom)?.current_balance || 0)}
                  </small>
                </label>

                <label>
                  Description
                  <input
                    required
                    value={transferDesc}
                    onChange={e => setTransferDesc(e.target.value)}
                    placeholder="e.g. ATM cash withdrawal, Move funds to Savings"
                  />
                </label>

                <label>
                  Family Member (Optional)
                  <select value={transferMember} onChange={e => setTransferMember(e.target.value)}>
                    <option value="">Household / Shared</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </label>

                <label>
                  Transfer Date & Time
                  <input
                    type="datetime-local"
                    required
                    value={transferDate}
                    onChange={e => setTransferDate(e.target.value)}
                  />
                </label>

                <button className="primary full" disabled={busy}>
                  {busy ? 'Transferring…' : 'Execute fund transfer'}
                </button>
              </form>
            )}

            {/* Modal: Record Loan */}
            {modal === 'loan' && (
              <form className="form-stack" onSubmit={saveLoan}>
                <label>
                  Person / Entity
                  <input
                    required
                    minLength={2}
                    value={loanPerson}
                    onChange={e => setLoanPerson(e.target.value)}
                    placeholder="e.g. Avimanyu, Sharmaji, Bank"
                  />
                </label>

                <label>
                  Loan Type
                  <select value={loanType} onChange={e => setLoanType(e.target.value as 'lent' | 'borrowed')}>
                    <option value="lent">Money Lent (You lend money to them — Debits your account)</option>
                    <option value="borrowed">Money Borrowed (You receive a loan — Credits your account)</option>
                  </select>
                </label>

                <label>
                  Account {loanType === 'lent' ? 'to Debit' : 'to Credit'}
                  <select required value={loanAccount} onChange={e => setLoanAccount(e.target.value)}>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — Available: {money(a.current_balance)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Family Member (Who {loanType === 'lent' ? 'gives' : 'takes'} the loan)
                  <select value={loanMember} onChange={e => setLoanMember(e.target.value)}>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.relationship_label})</option>)}
                  </select>
                </label>

                <label>
                  Principal Amount (₹)
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={loanPrincipal}
                    onChange={e => setLoanPrincipal(e.target.value)}
                    placeholder="10000.00"
                  />
                  {loanType === 'lent' && loanAccount && (
                    <small style={{ color: '#74867b' }}>
                      Max available to lend: {money(accounts.find(a => a.id === loanAccount)?.current_balance || 0)}
                    </small>
                  )}
                </label>

                <label>
                  Purpose / Notes
                  <input value={loanDesc} onChange={e => setLoanDesc(e.target.value)} placeholder="e.g. Emergency loan to friend" />
                </label>

                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : loanType === 'lent' ? 'Debit account & lend money' : 'Credit account & record borrowing'}
                </button>
              </form>
            )}

            {/* Modal: Loan Repayment */}
            {modal === 'loan_repay' && (
              <form className="form-stack" onSubmit={saveLoanRepayment}>
                <p className="muted" style={{ margin: 0 }}>
                  Outstanding remaining balance: <b>{money(selectedLoan?.remaining_amount || 0)}</b>
                </p>

                <label>
                  Repayment Amount (₹)
                  <input
                    required
                    type="number"
                    min="1"
                    max={Number(selectedLoan?.remaining_amount || 1000000)}
                    step="0.01"
                    value={loanRepayAmount}
                    onChange={e => setLoanRepayAmount(e.target.value)}
                    placeholder="5000.00"
                  />
                </label>

                <label>
                  {selectedLoan?.loan_type === 'lent' ? 'Account to Credit (Deposit into)' : 'Account to Debit (Pay from)'}
                  <select required value={loanRepayAccount} onChange={e => setLoanRepayAccount(e.target.value)}>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — Available: {money(a.current_balance)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Family Member credited/attributed
                  <select value={loanRepayMember} onChange={e => setLoanRepayMember(e.target.value)}>
                    <option value="">Household / Shared</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.relationship_label})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Payment Reference / Notes
                  <input
                    value={loanRepayNotes}
                    onChange={e => setLoanRepayNotes(e.target.value)}
                    placeholder="e.g. UPI transfer, Cash repayment"
                  />
                </label>

                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Confirm repayment & credit account'}
                </button>
              </form>
            )}

            {/* Modal: Add Member & Account */}
            {modal === 'member' && (
              <form className="form-stack" onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await api.addMember({
                    name: memberName.trim(),
                    relationship_label: memberRelation,
                    email: memberEmail.trim() || undefined,
                    role: memberRole,
                    initial_password: memberInitialPass.trim() || undefined,
                    initial_account_name: memberCreateAcc && memberInitialAccName.trim() ? memberInitialAccName.trim() : undefined,
                    initial_account_type: memberInitialAccType,
                    initial_account_balance: memberCreateAcc && memberInitialAccBalance ? memberInitialAccBalance : '0.00'
                  });
                  notifySuccess(`Family member ${memberName} added successfully.`);
                  setModal(null);
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to save member');
                } finally {
                  setBusy(false);
                }
              }}>
                <label>
                  Member Name
                  <input required minLength={2} value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="e.g. Avimanyu, Sanjukta" />
                </label>
                <label>
                  Relationship
                  <select value={memberRelation} onChange={e => setMemberRelation(e.target.value)}>
                    {['Self', 'Spouse', 'Child', 'Parent', 'Sibling', 'Other'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label>
                  Email Address (for login)
                  <input type="email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="member@example.com (Required for member login)" />
                  <small className="muted" style={{ fontSize: 9 }}>The member uses this email to sign in.</small>
                </label>
                <label>
                  Role & Permissions
                  <select value={memberRole} onChange={e => setMemberRole(e.target.value as 'admin' | 'member')}>
                    <option value="member">👤 Family Member (Standard)</option>
                    <option value="admin">👑 Family Admin (Full Access)</option>
                  </select>
                </label>
                <label>
                  Initial Password (Optional)
                  <input
                    type="password"
                    minLength={6}
                    value={memberInitialPass}
                    onChange={e => setMemberInitialPass(e.target.value)}
                    placeholder="Set temporary password for immediate sign in"
                  />
                  <small className="muted" style={{ fontSize: 9 }}>If provided, member can sign in right away with this password.</small>
                </label>

                <div style={{ borderTop: '1px solid #e7ede8', paddingTop: 10, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={memberCreateAcc}
                      onChange={e => {
                        setMemberCreateAcc(e.target.checked);
                        if (e.target.checked && !memberInitialAccName) {
                          setMemberInitialAccName(`${memberName ? memberName + "'s " : ''}Bank Account`);
                        }
                      }}
                      style={{ width: 'auto' }}
                    />
                    <span>Create an account for this member</span>
                  </label>
                </div>

                {memberCreateAcc && (
                  <div style={{ background: '#f8faf9', border: '1px solid #e5ede7', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
                    <label>
                      Account Name
                      <input
                        value={memberInitialAccName}
                        onChange={e => setMemberInitialAccName(e.target.value)}
                        placeholder="e.g. Avimanyu SBI Savings"
                      />
                    </label>
                    <label>
                      Account Type
                      <select value={memberInitialAccType} onChange={e => setMemberInitialAccType(e.target.value)}>
                        <option value="bank">Bank Account</option>
                        <option value="cash">Cash in Hand</option>
                        <option value="wallet">Digital Wallet / UPI</option>
                        <option value="investment">Investment / Demat</option>
                      </select>
                    </label>
                    <label>
                      Opening Balance (₹)
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={memberInitialAccBalance}
                        onChange={e => setMemberInitialAccBalance(e.target.value)}
                        placeholder="0.00"
                      />
                    </label>
                  </div>
                )}

                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Save Family Member'}
                </button>
              </form>
            )}

            {/* Modal: Edit Member */}
            {modal === 'edit_member' && editingMember && (
              <form className="form-stack" onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await api.updateMember(editingMember.id, {
                    name: memberName.trim(),
                    relationship_label: memberRelation,
                    email: memberEmail.trim() || undefined,
                    role: memberRole,
                  });
                  notifySuccess(`Member ${memberName} updated.`);
                  setModal(null);
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to update member');
                } finally {
                  setBusy(false);
                }
              }}>
                <label>
                  Member Name
                  <input required minLength={2} value={memberName} onChange={e => setMemberName(e.target.value)} />
                </label>
                <label>
                  Relationship
                  <select value={memberRelation} onChange={e => setMemberRelation(e.target.value)}>
                    {['Self', 'Spouse', 'Child', 'Parent', 'Sibling', 'Other'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label>
                  Email Address
                  <input type="email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="member@example.com" />
                </label>
                <label>
                  Role
                  <select value={memberRole} onChange={e => setMemberRole(e.target.value as 'admin' | 'member')}>
                    <option value="member">👤 Family Member (Standard)</option>
                    <option value="admin">👑 Family Admin (Full Access)</option>
                  </select>
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Update Member Details'}
                </button>
              </form>
            )}

            {/* Modal: Reset Password */}
            {modal === 'reset_password' && resetTargetMember && (
              <form className="form-stack" onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  const res = await api.resetMemberPassword(resetTargetMember.id, resetNewPass.trim());
                  notifySuccess(res.message);
                  setModal(null);
                  setResetNewPass('');
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to reset password');
                } finally {
                  setBusy(false);
                }
              }}>
                <div style={{ background: '#f0f6f2', border: '1px solid #d4e7db', borderRadius: 8, padding: 12, fontSize: 11, color: '#255038' }}>
                  🔑 Setting new password for <b>{resetTargetMember.name}</b> ({resetTargetMember.email || 'No email'}).
                </div>
                {!resetTargetMember.email && (
                  <p className="error" style={{ margin: 0 }}>
                    ⚠️ This member does not have an email assigned. Please edit the member and set their email first!
                  </p>
                )}
                <label>
                  New Password
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={resetNewPass}
                    onChange={e => setResetNewPass(e.target.value)}
                    placeholder="Enter at least 6 characters"
                  />
                </label>
                <button className="primary full" disabled={busy || !resetTargetMember.email}>
                  {busy ? 'Resetting…' : 'Reset Password Now'}
                </button>
              </form>
            )}

            {/* Modal: Create Account */}
            {modal === 'account' && (
              <form className="form-stack" onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await api.addAccount({
                    name: accName.trim(),
                    account_type: accType,
                    opening_balance: accOpening || '0.00',
                    member_id: accOwnerMember || null
                  });
                  notifySuccess('Account created.');
                  setModal(null);
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to add account');
                } finally {
                  setBusy(false);
                }
              }}>
                <label>
                  Account Name
                  <input required minLength={2} value={accName} onChange={e => setAccName(e.target.value)} placeholder="e.g. SBI Savings, HDFC, Cash" />
                </label>
                <label>
                  Account Type
                  <select value={accType} onChange={e => setAccType(e.target.value)}>
                    <option value="bank">Bank Account</option>
                    <option value="cash">Cash in Hand</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="wallet">Digital Wallet / UPI</option>
                    <option value="investment">Investment / Demat</option>
                  </select>
                </label>
                <label>
                  Account Owner (Family Member)
                  <select value={accOwnerMember} onChange={e => setAccOwnerMember(e.target.value)}>
                    <option value="">Joint / Shared Family Account</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.relationship_label})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Opening Balance (₹)
                  <input type="number" step="0.01" min="0" value={accOpening} onChange={e => setAccOpening(e.target.value)} placeholder="0.00" />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Create Account'}
                </button>
              </form>
            )}

            {/* Modal: Edit & Reassign Account */}
            {modal === 'edit_account' && editingAccount && (
              <form className="form-stack" onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await api.updateAccount(editingAccount.id, {
                    name: accName.trim(),
                    account_type: accType,
                    opening_balance: accOpening || '0.00',
                    member_id: accOwnerMember || null
                  });
                  notifySuccess('Account updated.');
                  setModal(null);
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to update account');
                } finally {
                  setBusy(false);
                }
              }}>
                <label>
                  Account Name
                  <input required minLength={2} value={accName} onChange={e => setAccName(e.target.value)} />
                </label>
                <label>
                  Account Type
                  <select value={accType} onChange={e => setAccType(e.target.value)}>
                    <option value="bank">Bank Account</option>
                    <option value="cash">Cash in Hand</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="wallet">Digital Wallet / UPI</option>
                    <option value="investment">Investment / Demat</option>
                  </select>
                </label>
                <label>
                  Account Owner (Reassign to Member)
                  <select value={accOwnerMember} onChange={e => setAccOwnerMember(e.target.value)}>
                    <option value="">Joint / Shared Family Account</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.relationship_label})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Opening Balance (₹)
                  <input type="number" step="0.01" min="0" value={accOpening} onChange={e => setAccOpening(e.target.value)} />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Save Account Changes'}
                </button>
              </form>
            )}

            {/* Modal: Budget */}
            {modal === 'budget' && (
              <form className="form-stack" onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await api.addBudget({ name: budgetName.trim(), category_id: budgetCategory || null, monthly_limit: budgetLimit });
                  notifySuccess('Budget created.');
                  setModal(null);
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create budget');
                } finally {
                  setBusy(false);
                }
              }}>
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
                  <input required type="number" min="1" step="0.01" value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)} placeholder="20000.00" />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Set budget'}
                </button>
              </form>
            )}

            {/* Modal: Goal */}
            {modal === 'goal' && (
              <form className="form-stack" onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await api.addSavingsGoal({ name: goalName.trim(), target_amount: goalTarget, current_amount: goalInitial || '0.00', notes: goalNotes.trim() || undefined });
                  notifySuccess('Savings goal set.');
                  setModal(null);
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create goal');
                } finally {
                  setBusy(false);
                }
              }}>
                <label>
                  Goal title
                  <input required minLength={2} value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="e.g. Emergency Fund, Vacation" />
                </label>
                <label>
                  Target amount (₹)
                  <input required type="number" min="1" step="0.01" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="100000.00" />
                </label>
                <label>
                  Starting amount (₹)
                  <input type="number" min="0" step="0.01" value={goalInitial} onChange={e => setGoalInitial(e.target.value)} placeholder="0.00" />
                </label>
                <label>
                  Notes
                  <input value={goalNotes} onChange={e => setGoalNotes(e.target.value)} placeholder="e.g. Target date: Diwali" />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Create goal'}
                </button>
              </form>
            )}

            {/* Modal: Goal Contribution */}
            {modal === 'goal_contribute' && (
              <form className="form-stack" onSubmit={async e => {
                e.preventDefault();
                if (!selectedGoal) return;
                setBusy(true);
                setError('');
                try {
                  await api.contributeSavingsGoal(selectedGoal.id, goalContribAmount);
                  notifySuccess(`Added ${money(goalContribAmount)} to "${selectedGoal.name}".`);
                  setModal(null);
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to add funds');
                } finally {
                  setBusy(false);
                }
              }}>
                <p className="muted" style={{ margin: 0 }}>
                  Current progress: {money(selectedGoal?.current_amount || 0)} of {money(selectedGoal?.target_amount || 0)}
                </p>
                <label>
                  Contribution amount (₹)
                  <input required type="number" min="1" step="0.01" value={goalContribAmount} onChange={e => setGoalContribAmount(e.target.value)} placeholder="5000.00" />
                </label>
                <button className="primary full" disabled={busy}>
                  {busy ? 'Saving…' : 'Deposit funds'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-bar">
        <button
          className={`mobile-tab-btn ${tab === 'Overview' ? 'active' : ''}`}
          onClick={() => { setTab('Overview'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </button>
        <button
          className={`mobile-tab-btn ${tab === 'Accounts & Transfers' ? 'active' : ''}`}
          onClick={() => { setTab('Accounts & Transfers'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <CreditCard size={18} />
          <span>Accounts</span>
        </button>
        <button
          className={`mobile-tab-btn ${tab === 'Transactions' ? 'active' : ''}`}
          onClick={() => { setTab('Transactions'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <ReceiptText size={18} />
          <span>Activity</span>
        </button>
        <button
          className={`mobile-tab-btn ${tab === 'Bank Statement' ? 'active' : ''}`}
          onClick={() => { setTab('Bank Statement'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <BookOpen size={18} />
          <span>Statement</span>
        </button>
        {userProfile?.role === 'admin' ? (
          <button
            className={`mobile-tab-btn ${tab === '👑 Admin Console' ? 'active' : ''}`}
            onClick={() => { setTab('👑 Admin Console'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            <ShieldCheck size={18} />
            <span>Admin</span>
          </button>
        ) : (
          <button
            className={`mobile-tab-btn ${tab === 'Family members' ? 'active' : ''}`}
            onClick={() => { setTab('Family members'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            <Users size={18} />
            <span>Family</span>
          </button>
        )}
      </nav>
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
            <th>CATEGORY / DETAILS</th>
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
                    {t.transaction_type === 'income' ? <ArrowDownLeft size={15} /> : t.transaction_type === 'transfer' ? <ArrowLeftRight size={14} /> : <ArrowUpRight size={15} />}
                  </span>
                  <b>{t.description}</b>
                </div>
              </td>
              <td>{new Date(t.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td>
                <span className="category-pill">
                  {t.category_name || (t.transfer_account_name ? `↔ ${t.transfer_account_name}` : 'General')}
                </span>
              </td>
              <td><span className="member-pill">{t.member_name || 'Household'}</span></td>
              <td><small>{t.account_name || 'Account'}</small></td>
              <td>
                <span className={`status ${t.transaction_type}`}>
                  {t.transaction_type === 'transfer' ? (t.direction === 'in' ? 'Transfer In' : 'Transfer Out') : t.transaction_type}
                </span>
              </td>
              <td className={`right amount ${t.transaction_type}`}>
                {t.transaction_type === 'income' || t.direction === 'in' ? '+' : '−'}{money(t.amount)}
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
