from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models.entities import TransactionType

class RegisterIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=6, max_length=128)
    household_name: str | None = Field(default="My Family", max_length=120)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserMeOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str # "admin" or "member"
    household_id: str
    household_name: str
    currency: str
    member_id: str | None = None
    member_name: str | None = None

class MemberIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    relationship_label: str = Field(default="Other", max_length=60)
    email: EmailStr | None = None
    role: str = Field(default="member", pattern="^(admin|member)$")
    initial_password: str | None = Field(default=None, min_length=6, max_length=128)
    initial_account_name: str | None = None
    initial_account_type: str = "bank"
    initial_account_balance: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2)

class MemberUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    relationship_label: str | None = Field(default=None, max_length=60)
    email: EmailStr | None = None
    role: str | None = Field(default=None, pattern="^(admin|member)$")
    is_active: bool | None = None

class MemberPasswordResetIn(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)

class MemberOut(BaseModel):
    id: str
    name: str
    relationship_label: str = "Other"
    email: str | None = None
    role: str = "member"
    user_id: str | None = None
    can_login: bool = False
    is_active: bool
    account_count: int = 0
    total_balance: Decimal = Decimal("0.00")
    model_config = ConfigDict(from_attributes=True)

class AccountIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    account_type: str = "cash"
    opening_balance: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2)
    member_id: str | None = None

class AccountUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    account_type: str | None = None
    opening_balance: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    member_id: str | None = None
    is_active: bool | None = None

class AccountOut(BaseModel):
    id: str
    name: str
    account_type: str
    opening_balance: Decimal
    current_balance: Decimal = Decimal("0.00")
    member_id: str | None = None
    member_name: str | None = None
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class TransferIn(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    description: str = Field(min_length=2, max_length=240, default="Account Transfer")
    transaction_date: datetime
    member_id: str | None = None

class TransferOut(BaseModel):
    message: str
    amount: Decimal
    from_account_id: str
    from_account_name: str
    from_account_balance: Decimal
    to_account_id: str
    to_account_name: str
    to_account_balance: Decimal

class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    transaction_type: TransactionType

class CategoryOut(CategoryIn):
    id: str
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class TransactionIn(BaseModel):
    member_id: str | None = None
    account_id: str
    category_id: str | None = None
    transaction_type: TransactionType
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    description: str = Field(min_length=2, max_length=240)
    transaction_date: datetime
    client_request_id: str | None = Field(default=None, max_length=64)

class TransactionUpdateIn(BaseModel):
    member_id: str | None = None
    account_id: str | None = None
    category_id: str | None = None
    transaction_type: TransactionType | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    description: str | None = Field(default=None, min_length=2, max_length=240)
    transaction_date: datetime | None = None

class TransactionOut(TransactionIn):
    id: str
    member_name: str | None = None
    account_name: str | None = None
    category_name: str | None = None
    transfer_account_id: str | None = None
    transfer_account_name: str | None = None
    direction: str | None = None
    loan_id: str | None = None
    model_config = ConfigDict(from_attributes=True)

class CategoryBreakdown(BaseModel):
    category_name: str
    total_amount: Decimal
    transaction_type: str
    percentage: float

class MonthlyTrend(BaseModel):
    month: str
    income: Decimal
    expense: Decimal
    savings: Decimal

class MemberBalanceOut(BaseModel):
    member_id: str | None = None
    member_name: str
    relationship_label: str = "Other"
    role: str = "member"
    email: str | None = None
    total_balance: Decimal = Decimal("0.00")
    account_count: int = 0
    accounts: list[AccountOut] = []

class DashboardOut(BaseModel):
    combined_balance: Decimal = Decimal("0.00")
    member_balances: list[MemberBalanceOut] = []
    total_income: Decimal
    total_expenses: Decimal
    net_savings: Decimal
    transaction_count: int
    category_breakdown: list[CategoryBreakdown] = []
    monthly_trend: list[MonthlyTrend] = []

class HouseholdUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    currency: str | None = Field(default=None, min_length=3, max_length=3)

class AuditLogOut(BaseModel):
    id: str
    actor_user_id: str
    actor_name: str | None = None
    entity_type: str
    entity_id: str
    action: str
    details: str | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class BudgetIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    category_id: str | None = None
    monthly_limit: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    month: str | None = None

class BudgetOut(BudgetIn):
    id: str
    category_name: str | None = None
    spent_amount: Decimal = Decimal("0.00")
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class SavingsGoalIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    target_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    current_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2)
    target_date: datetime | None = None
    notes: str | None = None

class SavingsGoalContributeIn(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)

class SavingsGoalOut(SavingsGoalIn):
    id: str
    is_completed: bool
    model_config = ConfigDict(from_attributes=True)

class LoanIn(BaseModel):
    person_name: str = Field(min_length=2, max_length=120)
    loan_type: str = Field(pattern="^(lent|borrowed)$")
    principal_amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    account_id: str
    member_id: str | None = None
    due_date: datetime | None = None
    description: str | None = None

class LoanRepaymentIn(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    account_id: str
    member_id: str | None = None
    notes: str | None = None

class LoanOut(BaseModel):
    id: str
    person_name: str
    loan_type: str
    principal_amount: Decimal
    repaid_amount: Decimal
    remaining_amount: Decimal
    account_id: str | None = None
    account_name: str | None = None
    member_id: str | None = None
    member_name: str | None = None
    due_date: datetime | None = None
    description: str | None = None
    is_settled: bool
    model_config = ConfigDict(from_attributes=True)

# -------------------------------------------------------------
# Ledger / Bank Statement Schemas
# -------------------------------------------------------------
class StatementEntryOut(BaseModel):
    id: str
    transaction_date: datetime
    description: str
    entry_type: str # "credit" or "debit"
    amount: Decimal
    debit_amount: Decimal
    credit_amount: Decimal
    running_balance: Decimal
    category_name: str | None = None
    member_name: str | None = None
    transfer_account_name: str | None = None

class AccountStatementOut(BaseModel):
    account_id: str
    account_name: str
    account_type: str
    from_date: str
    to_date: str
    opening_balance: Decimal
    total_credits: Decimal
    total_debits: Decimal
    closing_balance: Decimal
    transaction_count: int
    entries: list[StatementEntryOut]
