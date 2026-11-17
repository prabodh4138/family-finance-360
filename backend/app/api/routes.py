import csv
import io
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.entities import (
    User, Household, FamilyMember, Account, Transaction, AuditLog,
    Category, Budget, SavingsGoal, Loan, TransactionType
)
from app.schemas.api import (
    RegisterIn, LoginIn, TokenOut, MemberIn, MemberOut,
    AccountIn, AccountOut, CategoryIn, CategoryOut,
    TransactionIn, TransactionUpdateIn, TransactionOut,
    DashboardOut, CategoryBreakdown, MonthlyTrend,
    BudgetIn, BudgetOut,
    SavingsGoalIn, SavingsGoalOut, SavingsGoalContributeIn,
    LoanIn, LoanOut, LoanRepaymentIn
)
from app.api.deps import current_user, current_household

router = APIRouter()

DEFAULT_CATEGORIES = [
    # Expense
    ("Groceries & Food", TransactionType.expense),
    ("Housing & Rent", TransactionType.expense),
    ("Electricity & Utilities", TransactionType.expense),
    ("Transportation & Fuel", TransactionType.expense),
    ("Healthcare & Medical", TransactionType.expense),
    ("Education & Learning", TransactionType.expense),
    ("Shopping & Clothing", TransactionType.expense),
    ("Entertainment & Dining", TransactionType.expense),
    ("Household & Maintenance", TransactionType.expense),
    ("Miscellaneous", TransactionType.expense),
    # Income
    ("Salary & Wages", TransactionType.income),
    ("Business & Freelancing", TransactionType.income),
    ("Investments & Dividends", TransactionType.income),
    ("Gifts & Grants", TransactionType.income),
    ("Rental Income", TransactionType.income),
    ("Other Income", TransactionType.income),
]

def ensure_default_categories(household_id: str, db: Session):
    existing = db.query(Category.name).filter(Category.household_id == household_id).all()
    existing_names = {name for (name,) in existing}
    for name, tx_type in DEFAULT_CATEGORIES:
        if name not in existing_names:
            db.add(Category(household_id=household_id, name=name, transaction_type=tx_type))
    db.commit()


# ==========================================
# AUTHENTICATION
# ==========================================

@router.post("/auth/register", response_model=TokenOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=email, full_name=payload.full_name, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()

    household = Household(owner_id=user.id, name=payload.household_name, currency="INR")
    db.add(household)
    db.flush()

    # Default Cash and Bank accounts
    db.add(Account(household_id=household.id, name="Cash", account_type="cash", opening_balance=Decimal("0.00")))
    db.add(Account(household_id=household.id, name="Bank Account", account_type="bank", opening_balance=Decimal("0.00")))

    # Default self family member
    db.add(FamilyMember(household_id=household.id, name=payload.full_name, relationship_label="Self"))

    # Seed default categories
    for name, tx_type in DEFAULT_CATEGORIES:
        db.add(Category(household_id=household.id, name=name, transaction_type=tx_type))

    db.commit()
    return TokenOut(access_token=create_access_token(user.id))

@router.post("/auth/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")
    return TokenOut(access_token=create_access_token(user.id))

@router.get("/auth/me")
def me(user: User = Depends(current_user), h: Household = Depends(current_household)):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "household_id": h.id,
        "household_name": h.name,
        "currency": h.currency
    }


# ==========================================
# CATEGORIES
# ==========================================

@router.get("/categories", response_model=list[CategoryOut])
def list_categories(h: Household = Depends(current_household), db: Session = Depends(get_db)):
    ensure_default_categories(h.id, db)
    return db.query(Category).filter(
        Category.household_id == h.id,
        Category.is_active.is_(True)
    ).order_by(Category.transaction_type, Category.name).all()

@router.post("/categories", response_model=CategoryOut, status_code=201)
def add_category(payload: CategoryIn, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    cat = Category(household_id=h.id, **payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# ==========================================
# FAMILY MEMBERS
# ==========================================

@router.get("/members", response_model=list[MemberOut])
def list_members(h: Household = Depends(current_household), db: Session = Depends(get_db)):
    return db.query(FamilyMember).filter(FamilyMember.household_id == h.id).order_by(FamilyMember.name).all()

@router.post("/members", response_model=MemberOut, status_code=201)
def add_member(payload: MemberIn, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    member = FamilyMember(household_id=h.id, **payload.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member

@router.patch("/members/{member_id}", response_model=MemberOut)
def edit_member(member_id: str, payload: MemberIn, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    member = db.query(FamilyMember).filter(FamilyMember.id == member_id, FamilyMember.household_id == h.id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")
    member.name = payload.name
    member.relationship_label = payload.relationship_label
    db.commit()
    db.refresh(member)
    return member

@router.delete("/members/{member_id}", status_code=204)
def deactivate_member(member_id: str, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    member = db.query(FamilyMember).filter(FamilyMember.id == member_id, FamilyMember.household_id == h.id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")
    member.is_active = False
    db.commit()


# ==========================================
# ACCOUNTS (WITH REAL-TIME BALANCES)
# ==========================================

@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(h: Household = Depends(current_household), db: Session = Depends(get_db)):
    accounts = db.query(Account).filter(Account.household_id == h.id, Account.is_active.is_(True)).all()
    results = []
    for acc in accounts:
        # Sum income
        income = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.household_id == h.id,
            Transaction.account_id == acc.id,
            Transaction.transaction_type == TransactionType.income,
            Transaction.deleted_at.is_(None)
        ).scalar() or Decimal("0.00")

        # Sum expense
        expense = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.household_id == h.id,
            Transaction.account_id == acc.id,
            Transaction.transaction_type == TransactionType.expense,
            Transaction.deleted_at.is_(None)
        ).scalar() or Decimal("0.00")

        balance = acc.opening_balance + Decimal(str(income)) - Decimal(str(expense))
        results.append(AccountOut(
            id=acc.id,
            name=acc.name,
            account_type=acc.account_type,
            opening_balance=acc.opening_balance,
            current_balance=balance,
            is_active=acc.is_active
        ))
    return results

@router.post("/accounts", response_model=AccountOut, status_code=201)
def add_account(payload: AccountIn, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    account = Account(household_id=h.id, **payload.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return AccountOut(
        id=account.id,
        name=account.name,
        account_type=account.account_type,
        opening_balance=account.opening_balance,
        current_balance=account.opening_balance,
        is_active=account.is_active
    )


# ==========================================
# TRANSACTIONS
# ==========================================

def format_tx_out(tx: Transaction) -> TransactionOut:
    return TransactionOut(
        id=tx.id,
        account_id=tx.account_id,
        account_name=tx.account.name if tx.account else None,
        member_id=tx.member_id,
        member_name=tx.member.name if tx.member else None,
        category_id=tx.category_id,
        category_name=tx.category.name if tx.category else None,
        transaction_type=tx.transaction_type,
        amount=tx.amount,
        description=tx.description,
        transaction_date=tx.transaction_date,
        client_request_id=tx.client_request_id
    )

@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(
    type: str | None = None,
    member_id: str | None = None,
    account_id: str | None = None,
    category_id: str | None = None,
    month: str | None = None, # "YYYY-MM"
    search: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    h: Household = Depends(current_household),
    db: Session = Depends(get_db)
):
    q = db.query(Transaction).filter(
        Transaction.household_id == h.id,
        Transaction.deleted_at.is_(None)
    )
    if type and type in [t.value for t in TransactionType]:
        q = q.filter(Transaction.transaction_type == type)
    if member_id:
        q = q.filter(Transaction.member_id == member_id)
    if account_id:
        q = q.filter(Transaction.account_id == account_id)
    if category_id:
        q = q.filter(Transaction.category_id == category_id)
    if month:
        try:
            dt = datetime.strptime(month, "%Y-%m")
            q = q.filter(
                func.extract("year", Transaction.transaction_date) == dt.year,
                func.extract("month", Transaction.transaction_date) == dt.month
            )
        except ValueError:
            pass
    if search:
        s = f"%{search.strip().lower()}%"
        q = q.filter(func.lower(Transaction.description).like(s))

    items = q.order_by(Transaction.transaction_date.desc()).offset(offset).limit(limit).all()
    return [format_tx_out(tx) for tx in items]

@router.get("/transactions/export/csv")
def export_transactions_csv(
    month: str | None = None,
    h: Household = Depends(current_household),
    db: Session = Depends(get_db)
):
    q = db.query(Transaction).filter(
        Transaction.household_id == h.id,
        Transaction.deleted_at.is_(None)
    )
    if month:
        try:
            dt = datetime.strptime(month, "%Y-%m")
            q = q.filter(
                func.extract("year", Transaction.transaction_date) == dt.year,
                func.extract("month", Transaction.transaction_date) == dt.month
            )
        except ValueError:
            pass

    items = q.order_by(Transaction.transaction_date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Date", "Description", "Type", "Amount (INR)", "Account", "Category", "Family Member"])
    for tx in items:
        writer.writerow([
            tx.id,
            tx.transaction_date.strftime("%Y-%m-%d %H:%M"),
            tx.description,
            tx.transaction_type.value.capitalize(),
            str(tx.amount),
            tx.account.name if tx.account else "",
            tx.category.name if tx.category else "Uncategorized",
            tx.member.name if tx.member else "Household"
        ])

    filename = f"transactions_{month or 'all'}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/transactions", response_model=TransactionOut, status_code=201)
def add_transaction(
    payload: TransactionIn,
    user: User = Depends(current_user),
    h: Household = Depends(current_household),
    db: Session = Depends(get_db)
):
    account = db.query(Account).filter(Account.id == payload.account_id, Account.household_id == h.id, Account.is_active.is_(True)).first()
    if not account:
        raise HTTPException(status_code=422, detail="Select a valid household account")
    if payload.member_id:
        member = db.query(FamilyMember).filter(FamilyMember.id == payload.member_id, FamilyMember.household_id == h.id, FamilyMember.is_active.is_(True)).first()
        if not member:
            raise HTTPException(status_code=422, detail="Select an active family member")
    if payload.category_id:
        category = db.query(Category).filter(Category.id == payload.category_id, Category.household_id == h.id).first()
        if not category:
            raise HTTPException(status_code=422, detail="Select a valid category")
    if payload.client_request_id:
        existing = db.query(Transaction).filter(Transaction.household_id == h.id, Transaction.client_request_id == payload.client_request_id).first()
        if existing:
            return format_tx_out(existing)

    tx = Transaction(household_id=h.id, **payload.model_dump())
    db.add(tx)
    db.flush()
    db.add(AuditLog(household_id=h.id, actor_user_id=user.id, entity_type="transaction", entity_id=tx.id, action="create"))
    db.commit()
    db.refresh(tx)
    return format_tx_out(tx)

@router.patch("/transactions/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: str,
    payload: TransactionUpdateIn,
    user: User = Depends(current_user),
    h: Household = Depends(current_household),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.household_id == h.id, Transaction.deleted_at.is_(None)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    data = payload.model_dump(exclude_unset=True)
    if "account_id" in data and data["account_id"]:
        acc = db.query(Account).filter(Account.id == data["account_id"], Account.household_id == h.id).first()
        if not acc: raise HTTPException(status_code=422, detail="Invalid account")
    if "member_id" in data and data["member_id"]:
        m = db.query(FamilyMember).filter(FamilyMember.id == data["member_id"], FamilyMember.household_id == h.id).first()
        if not m: raise HTTPException(status_code=422, detail="Invalid member")
    if "category_id" in data and data["category_id"]:
        cat = db.query(Category).filter(Category.id == data["category_id"], Category.household_id == h.id).first()
        if not cat: raise HTTPException(status_code=422, detail="Invalid category")

    for k, v in data.items():
        setattr(tx, k, v)

    db.add(AuditLog(household_id=h.id, actor_user_id=user.id, entity_type="transaction", entity_id=tx.id, action="update"))
    db.commit()
    db.refresh(tx)
    return format_tx_out(tx)

@router.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: str,
    user: User = Depends(current_user),
    h: Household = Depends(current_household),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id, Transaction.household_id == h.id, Transaction.deleted_at.is_(None)).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    tx.deleted_at = datetime.now(timezone.utc)
    db.add(AuditLog(household_id=h.id, actor_user_id=user.id, entity_type="transaction", entity_id=tx.id, action="soft_delete"))
    db.commit()


# ==========================================
# DASHBOARD & ANALYTICS
# ==========================================

@router.get("/dashboard/summary", response_model=DashboardOut)
def dashboard_summary(
    month: str | None = None, # "YYYY-MM"
    h: Household = Depends(current_household),
    db: Session = Depends(get_db)
):
    base_filter = [Transaction.household_id == h.id, Transaction.deleted_at.is_(None)]

    if month:
        try:
            target_dt = datetime.strptime(month, "%Y-%m")
            month_filter = (
                func.extract("year", Transaction.transaction_date) == target_dt.year,
                func.extract("month", Transaction.transaction_date) == target_dt.month
            )
        except ValueError:
            month_filter = (func.date_trunc("month", Transaction.transaction_date) == func.date_trunc("month", func.now()),)
    else:
        month_filter = (func.date_trunc("month", Transaction.transaction_date) == func.date_trunc("month", func.now()),)

    # 1. Monthly Income & Expenses Totals
    rows = db.query(
        Transaction.transaction_type,
        func.coalesce(func.sum(Transaction.amount), 0),
        func.count(Transaction.id)
    ).filter(*base_filter, *month_filter).group_by(Transaction.transaction_type).all()

    income = sum((Decimal(str(total)) for typ, total, _ in rows if typ == TransactionType.income), Decimal("0"))
    expenses = sum((Decimal(str(total)) for typ, total, _ in rows if typ == TransactionType.expense), Decimal("0"))
    count = sum(n for _, _, n in rows)

    # 2. Category Breakdown for Expenses
    cat_rows = db.query(
        Category.name,
        func.coalesce(func.sum(Transaction.amount), 0)
    ).join(Category, Transaction.category_id == Category.id).filter(
        *base_filter,
        *month_filter,
        Transaction.transaction_type == TransactionType.expense
    ).group_by(Category.name).order_by(func.sum(Transaction.amount).desc()).all()

    breakdown = []
    for cat_name, cat_total in cat_rows:
        val = Decimal(str(cat_total))
        pct = float((val / expenses * 100)) if expenses > 0 else 0.0
        breakdown.append(CategoryBreakdown(
            category_name=cat_name,
            total_amount=val,
            transaction_type="expense",
            percentage=round(pct, 1)
        ))

    # 3. Monthly Trend (Last 6 Months)
    trend_rows = db.query(
        func.to_char(Transaction.transaction_date, 'YYYY-MM').label("m"),
        Transaction.transaction_type,
        func.coalesce(func.sum(Transaction.amount), 0)
    ).filter(*base_filter).group_by("m", Transaction.transaction_type).order_by("m").all()

    months_map: dict[str, dict] = {}
    for m_label, typ, amt in trend_rows:
        if m_label not in months_map:
            months_map[m_label] = {"income": Decimal("0.00"), "expense": Decimal("0.00")}
        if typ == TransactionType.income:
            months_map[m_label]["income"] += Decimal(str(amt))
        elif typ == TransactionType.expense:
            months_map[m_label]["expense"] += Decimal(str(amt))

    monthly_trend = [
        MonthlyTrend(
            month=k,
            income=v["income"],
            expense=v["expense"],
            savings=v["income"] - v["expense"]
        ) for k, v in sorted(months_map.items())[-6:]
    ]

    return DashboardOut(
        total_income=income,
        total_expenses=expenses,
        net_savings=income - expenses,
        transaction_count=count,
        category_breakdown=breakdown,
        monthly_trend=monthly_trend
    )


# ==========================================
# BUDGETS
# ==========================================

@router.get("/budgets", response_model=list[BudgetOut])
def list_budgets(h: Household = Depends(current_household), db: Session = Depends(get_db)):
    budgets = db.query(Budget).filter(Budget.household_id == h.id, Budget.is_active.is_(True)).all()
    results = []
    for b in budgets:
        # Calculate current month spending for this budget
        q = db.query(func.coalesce(func.sum(Transaction.amount), 0)).filter(
            Transaction.household_id == h.id,
            Transaction.transaction_type == TransactionType.expense,
            Transaction.deleted_at.is_(None),
            func.date_trunc("month", Transaction.transaction_date) == func.date_trunc("month", func.now())
        )
        if b.category_id:
            q = q.filter(Transaction.category_id == b.category_id)

        spent = Decimal(str(q.scalar() or 0))
        results.append(BudgetOut(
            id=b.id,
            name=b.name,
            category_id=b.category_id,
            category_name=b.category.name if b.category else "All Categories",
            monthly_limit=b.monthly_limit,
            spent_amount=spent,
            month=b.month,
            is_active=b.is_active
        ))
    return results

@router.post("/budgets", response_model=BudgetOut, status_code=201)
def add_budget(payload: BudgetIn, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    b = Budget(household_id=h.id, **payload.model_dump())
    db.add(b)
    db.commit()
    db.refresh(b)
    return BudgetOut(
        id=b.id,
        name=b.name,
        category_id=b.category_id,
        category_name=b.category.name if b.category else "All Categories",
        monthly_limit=b.monthly_limit,
        spent_amount=Decimal("0.00"),
        month=b.month,
        is_active=b.is_active
    )

@router.delete("/budgets/{budget_id}", status_code=204)
def delete_budget(budget_id: str, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    b = db.query(Budget).filter(Budget.id == budget_id, Budget.household_id == h.id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")
    b.is_active = False
    db.commit()


# ==========================================
# SAVINGS GOALS
# ==========================================

@router.get("/savings-goals", response_model=list[SavingsGoalOut])
def list_savings_goals(h: Household = Depends(current_household), db: Session = Depends(get_db)):
    return db.query(SavingsGoal).filter(SavingsGoal.household_id == h.id).order_by(SavingsGoal.created_at.desc()).all()

@router.post("/savings-goals", response_model=SavingsGoalOut, status_code=201)
def add_savings_goal(payload: SavingsGoalIn, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    goal = SavingsGoal(household_id=h.id, **payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal

@router.post("/savings-goals/{goal_id}/contribute", response_model=SavingsGoalOut)
def contribute_to_goal(goal_id: str, payload: SavingsGoalContributeIn, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    goal = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id, SavingsGoal.household_id == h.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    goal.current_amount += payload.amount
    if goal.current_amount >= goal.target_amount:
        goal.is_completed = True
    db.commit()
    db.refresh(goal)
    return goal

@router.delete("/savings-goals/{goal_id}", status_code=204)
def delete_savings_goal(goal_id: str, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    goal = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id, SavingsGoal.household_id == h.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    db.delete(goal)
    db.commit()


# ==========================================
# LOANS & BORROWING LEDGER
# ==========================================

@router.get("/loans", response_model=list[LoanOut])
def list_loans(h: Household = Depends(current_household), db: Session = Depends(get_db)):
    loans = db.query(Loan).filter(Loan.household_id == h.id).order_by(Loan.is_settled, Loan.created_at.desc()).all()
    results = []
    for ln in loans:
        rem = max(Decimal("0.00"), ln.principal_amount - ln.repaid_amount)
        results.append(LoanOut(
            id=ln.id,
            person_name=ln.person_name,
            loan_type=ln.loan_type,
            principal_amount=ln.principal_amount,
            repaid_amount=ln.repaid_amount,
            remaining_amount=rem,
            due_date=ln.due_date,
            description=ln.description,
            is_settled=ln.is_settled
        ))
    return results

@router.post("/loans", response_model=LoanOut, status_code=201)
def add_loan(payload: LoanIn, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    ln = Loan(household_id=h.id, **payload.model_dump())
    db.add(ln)
    db.commit()
    db.refresh(ln)
    return LoanOut(
        id=ln.id,
        person_name=ln.person_name,
        loan_type=ln.loan_type,
        principal_amount=ln.principal_amount,
        repaid_amount=ln.repaid_amount,
        remaining_amount=ln.principal_amount,
        due_date=ln.due_date,
        description=ln.description,
        is_settled=ln.is_settled
    )

@router.post("/loans/{loan_id}/repayment", response_model=LoanOut)
def record_loan_repayment(loan_id: str, payload: LoanRepaymentIn, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    ln = db.query(Loan).filter(Loan.id == loan_id, Loan.household_id == h.id).first()
    if not ln:
        raise HTTPException(status_code=404, detail="Loan not found")
    ln.repaid_amount += payload.amount
    if ln.repaid_amount >= ln.principal_amount:
        ln.is_settled = True
    db.commit()
    db.refresh(ln)
    rem = max(Decimal("0.00"), ln.principal_amount - ln.repaid_amount)
    return LoanOut(
        id=ln.id,
        person_name=ln.person_name,
        loan_type=ln.loan_type,
        principal_amount=ln.principal_amount,
        repaid_amount=ln.repaid_amount,
        remaining_amount=rem,
        due_date=ln.due_date,
        description=ln.description,
        is_settled=ln.is_settled
    )

@router.delete("/loans/{loan_id}", status_code=204)
def delete_loan(loan_id: str, h: Household = Depends(current_household), db: Session = Depends(get_db)):
    ln = db.query(Loan).filter(Loan.id == loan_id, Loan.household_id == h.id).first()
    if not ln:
        raise HTTPException(status_code=404, detail="Loan not found")
    db.delete(ln)
    db.commit()
