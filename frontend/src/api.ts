const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export function getToken() {
  return localStorage.getItem('ff360_access_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface Member {
  id: string;
  name: string;
  relationship_label: string;
  is_active: boolean;
}

export interface Account {
  id: string;
  name: string;
  account_type: string;
  opening_balance: string | number;
  current_balance: string | number;
  is_active: boolean;
}

export interface Category {
  id: string;
  name: string;
  transaction_type: 'income' | 'expense' | 'transfer';
  is_active: boolean;
}

export interface Transaction {
  id: string;
  account_id: string;
  account_name?: string;
  member_id?: string | null;
  member_name?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  transaction_type: 'income' | 'expense' | 'transfer';
  amount: string | number;
  description: string;
  transaction_date: string;
  client_request_id?: string | null;
}

export interface NewTransaction {
  account_id: string;
  member_id?: string | null;
  category_id?: string | null;
  transaction_type: 'income' | 'expense';
  amount: string | number;
  description: string;
  transaction_date: string;
  client_request_id: string;
}

export interface CategoryBreakdown {
  category_name: string;
  total_amount: string | number;
  transaction_type: string;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  income: string | number;
  expense: string | number;
  savings: string | number;
}

export interface Summary {
  total_income: string | number;
  total_expenses: string | number;
  net_savings: string | number;
  transaction_count: number;
  category_breakdown: CategoryBreakdown[];
  monthly_trend: MonthlyTrend[];
}

export interface Budget {
  id: string;
  name: string;
  category_id?: string | null;
  category_name?: string | null;
  monthly_limit: string | number;
  spent_amount: string | number;
  month?: string | null;
  is_active: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: string | number;
  current_amount: string | number;
  target_date?: string | null;
  notes?: string | null;
  is_completed: boolean;
}

export interface Loan {
  id: string;
  person_name: string;
  loan_type: 'lent' | 'borrowed';
  principal_amount: string | number;
  repaid_amount: string | number;
  remaining_amount: string | number;
  due_date?: string | null;
  description?: string | null;
  is_settled: boolean;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload: { email: string; full_name: string; password: string; household_name: string }) =>
    request<{ access_token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request<{ id: string; email: string; full_name: string; household_name: string; currency: string }>('/auth/me'),

  // Categories
  categories: () => request<Category[]>('/categories'),
  addCategory: (payload: { name: string; transaction_type: string }) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify(payload) }),

  // Members
  members: () => request<Member[]>('/members'),
  addMember: (payload: { name: string; relationship_label: string }) =>
    request<Member>('/members', { method: 'POST', body: JSON.stringify(payload) }),
  editMember: (id: string, payload: { name: string; relationship_label: string }) =>
    request<Member>(`/members/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteMember: (id: string) => request<void>(`/members/${id}`, { method: 'DELETE' }),

  // Accounts
  accounts: () => request<Account[]>('/accounts'),
  addAccount: (payload: { name: string; account_type: string; opening_balance: string | number }) =>
    request<Account>('/accounts', { method: 'POST', body: JSON.stringify(payload) }),

  // Transactions
  transactions: (params: { type?: string; member_id?: string; category_id?: string; account_id?: string; month?: string; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.type) q.append('type', params.type);
    if (params.member_id) q.append('member_id', params.member_id);
    if (params.category_id) q.append('category_id', params.category_id);
    if (params.account_id) q.append('account_id', params.account_id);
    if (params.month) q.append('month', params.month);
    if (params.search) q.append('search', params.search);
    const queryString = q.toString() ? `?${q.toString()}` : '';
    return request<Transaction[]>(`/transactions${queryString}`);
  },
  addTransaction: (payload: NewTransaction) =>
    request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(payload) }),
  editTransaction: (id: string, payload: Partial<NewTransaction>) =>
    request<Transaction>(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTransaction: (id: string) => request<void>(`/transactions/${id}`, { method: 'DELETE' }),
  exportCsvUrl: (month?: string) => `${API_BASE}/transactions/export/csv${month ? `?month=${month}` : ''}`,

  // Dashboard
  summary: (month?: string) => request<Summary>(`/dashboard/summary${month ? `?month=${month}` : ''}`),

  // Budgets
  budgets: () => request<Budget[]>('/budgets'),
  addBudget: (payload: { name: string; category_id?: string | null; monthly_limit: string | number }) =>
    request<Budget>('/budgets', { method: 'POST', body: JSON.stringify(payload) }),
  deleteBudget: (id: string) => request<void>(`/budgets/${id}`, { method: 'DELETE' }),

  // Savings Goals
  savingsGoals: () => request<SavingsGoal[]>('/savings-goals'),
  addSavingsGoal: (payload: { name: string; target_amount: string | number; current_amount?: string | number; notes?: string }) =>
    request<SavingsGoal>('/savings-goals', { method: 'POST', body: JSON.stringify(payload) }),
  contributeSavingsGoal: (id: string, amount: string | number) =>
    request<SavingsGoal>(`/savings-goals/${id}/contribute`, { method: 'POST', body: JSON.stringify({ amount }) }),
  deleteSavingsGoal: (id: string) => request<void>(`/savings-goals/${id}`, { method: 'DELETE' }),

  // Loans
  loans: () => request<Loan[]>('/loans'),
  addLoan: (payload: { person_name: string; loan_type: 'lent' | 'borrowed'; principal_amount: string | number; description?: string; due_date?: string }) =>
    request<Loan>('/loans', { method: 'POST', body: JSON.stringify(payload) }),
  recordLoanRepayment: (id: string, amount: string | number) =>
    request<Loan>(`/loans/${id}/repayment`, { method: 'POST', body: JSON.stringify({ amount }) }),
  deleteLoan: (id: string) => request<void>(`/loans/${id}`, { method: 'DELETE' }),
};
