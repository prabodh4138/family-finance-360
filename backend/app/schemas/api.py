from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models.entities import TransactionType

class RegisterIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=12, max_length=128)
    household_name: str = Field(default="My Family", min_length=2, max_length=120)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class MemberIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    relationship_label: str = Field(default="Other", max_length=60)

class MemberOut(MemberIn):
    id: str
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class AccountIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    account_type: str = "cash"
    opening_balance: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=14, decimal_places=2)

class AccountOut(AccountIn):
    id: str
    current_balance: Decimal = Decimal("0.00")
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

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

class DashboardOut(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    net_savings: Decimal
    transaction_count: int
    category_breakdown: list[CategoryBreakdown] = []
    monthly_trend: list[MonthlyTrend] = []

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
    due_date: datetime | None = None
    description: str | None = None

class LoanRepaymentIn(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)

class LoanOut(LoanIn):
    id: str
    repaid_amount: Decimal
    remaining_amount: Decimal
    is_settled: bool
    model_config = ConfigDict(from_attributes=True)
