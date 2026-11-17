import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_production_api_lifecycle():
    # 1. Register a new user
    uid = uuid.uuid4().hex[:8]
    test_email = f"prod_user_{uid}@example.com"
    test_password = "ProductionPassword123!"
    reg_resp = client.post("/api/v1/auth/register", json={
        "email": test_email,
        "full_name": "Kavita Rao",
        "password": test_password,
        "household_name": "Rao Family"
    })
    assert reg_resp.status_code == 201, reg_resp.text
    token = reg_resp.json()["access_token"]
    assert token

    headers = {"Authorization": f"Bearer {token}"}

    # Verify Security Headers
    assert reg_resp.headers.get("x-frame-options") == "DENY"
    assert reg_resp.headers.get("x-content-type-options") == "nosniff"

    # 2. Duplicate registration check
    dup_resp = client.post("/api/v1/auth/register", json={
        "email": test_email,
        "full_name": "Duplicate User",
        "password": test_password,
        "household_name": "Rao Family"
    })
    assert dup_resp.status_code == 409

    # 3. Login
    login_resp = client.post("/api/v1/auth/login", json={
        "email": test_email,
        "password": test_password
    })
    assert login_resp.status_code == 200

    # 4. Auth Me
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == test_email
    assert me_data["household_name"] == "Rao Family"

    # 5. Default Categories Seeded
    cat_resp = client.get("/api/v1/categories", headers=headers)
    assert cat_resp.status_code == 200
    categories = cat_resp.json()
    assert len(categories) >= 10
    grocery_cat = next((c for c in categories if "Groceries" in c["name"]), None)
    salary_cat = next((c for c in categories if "Salary" in c["name"]), None)
    assert grocery_cat is not None
    assert salary_cat is not None

    # Add custom category
    custom_cat_resp = client.post("/api/v1/categories", headers=headers, json={
        "name": "Fitness & Sports",
        "transaction_type": "expense"
    })
    assert custom_cat_resp.status_code == 201
    fitness_cat = custom_cat_resp.json()

    # 6. Accounts Check & Add New Account
    acc_resp = client.get("/api/v1/accounts", headers=headers)
    assert acc_resp.status_code == 200
    accounts = acc_resp.json()
    assert len(accounts) >= 2 # Cash and Bank Account
    cash_acc = next(a for a in accounts if a["name"] == "Cash")
    assert Decimal(str(cash_acc["current_balance"])) == Decimal("0.00")

    # Add ICICI Bank account
    icici_resp = client.post("/api/v1/accounts", headers=headers, json={
        "name": "ICICI Salary Account",
        "account_type": "bank",
        "opening_balance": "25000.00"
    })
    assert icici_resp.status_code == 201
    icici_acc = icici_resp.json()
    assert Decimal(str(icici_acc["current_balance"])) == Decimal("25000.00")

    # 7. Family Members
    mem_resp = client.get("/api/v1/members", headers=headers)
    assert mem_resp.status_code == 200
    members = mem_resp.json()
    assert len(members) >= 1 # Self

    # Add child
    child_resp = client.post("/api/v1/members", headers=headers, json={
        "name": "Rohan",
        "relationship_label": "Child"
    })
    assert child_resp.status_code == 201
    child_member = child_resp.json()

    # 8. Transactions: Income & Expense
    now_iso = datetime.now(timezone.utc).isoformat()
    req_1 = str(uuid.uuid4())
    inc_resp = client.post("/api/v1/transactions", headers=headers, json={
        "account_id": icici_acc["id"],
        "member_id": members[0]["id"],
        "category_id": salary_cat["id"],
        "transaction_type": "income",
        "amount": "120000.00",
        "description": "Tech Corp Monthly Salary",
        "transaction_date": now_iso,
        "client_request_id": req_1
    })
    assert inc_resp.status_code == 201, inc_resp.text
    inc_tx = inc_resp.json()
    assert inc_tx["account_name"] == "ICICI Salary Account"
    assert inc_tx["category_name"] == salary_cat["name"]

    # Expense transaction
    req_2 = str(uuid.uuid4())
    exp_resp = client.post("/api/v1/transactions", headers=headers, json={
        "account_id": icici_acc["id"],
        "member_id": members[0]["id"],
        "category_id": grocery_cat["id"],
        "transaction_type": "expense",
        "amount": "14500.00",
        "description": "Supermarket Shopping",
        "transaction_date": now_iso,
        "client_request_id": req_2
    })
    assert exp_resp.status_code == 201
    exp_tx = exp_resp.json()

    # Second expense with custom category
    req_3 = str(uuid.uuid4())
    exp2_resp = client.post("/api/v1/transactions", headers=headers, json={
        "account_id": cash_acc["id"],
        "member_id": child_member["id"],
        "category_id": fitness_cat["id"],
        "transaction_type": "expense",
        "amount": "3500.00",
        "description": "Badminton Coaching",
        "transaction_date": now_iso,
        "client_request_id": req_3
    })
    assert exp2_resp.status_code == 201

    # Verify Account Real-time Calculated Balances
    accs_updated = client.get("/api/v1/accounts", headers=headers).json()
    icici_updated = next(a for a in accs_updated if a["id"] == icici_acc["id"])
    # 25000 + 120000 - 14500 = 130500.00
    assert Decimal(str(icici_updated["current_balance"])) == Decimal("130500.00")

    cash_updated = next(a for a in accs_updated if a["id"] == cash_acc["id"])
    # 0 - 3500 = -3500.00
    assert Decimal(str(cash_updated["current_balance"])) == Decimal("-3500.00")

    # 9. Edit Transaction
    patch_resp = client.patch(f"/api/v1/transactions/{exp_tx['id']}", headers=headers, json={
        "amount": "15000.00",
        "description": "Supermarket Shopping & Pantry"
    })
    assert patch_resp.status_code == 200
    assert Decimal(str(patch_resp.json()["amount"])) == Decimal("15000.00")

    # 10. Dashboard Summary & Category Breakdown
    summary_resp = client.get("/api/v1/dashboard/summary", headers=headers)
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert Decimal(str(summary["total_income"])) == Decimal("120000.00")
    # 15000 + 3500 = 18500.00
    assert Decimal(str(summary["total_expenses"])) == Decimal("18500.00")
    assert Decimal(str(summary["net_savings"])) == Decimal("101500.00")
    assert summary["transaction_count"] == 3
    assert len(summary["category_breakdown"]) >= 2

    # 11. Export Transactions CSV
    csv_resp = client.get("/api/v1/transactions/export/csv", headers=headers)
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers.get("content-type", "")
    assert "Tech Corp Monthly Salary" in csv_resp.text
    assert "Supermarket Shopping & Pantry" in csv_resp.text

    # 12. Budgets CRUD
    b_resp = client.post("/api/v1/budgets", headers=headers, json={
        "name": "Monthly Food Budget",
        "category_id": grocery_cat["id"],
        "monthly_limit": "20000.00"
    })
    assert b_resp.status_code == 201
    budget = b_resp.json()

    # List budgets should show spent amount
    b_list = client.get("/api/v1/budgets", headers=headers).json()
    assert len(b_list) >= 1
    food_b = next(b for b in b_list if b["id"] == budget["id"])
    assert Decimal(str(food_b["spent_amount"])) == Decimal("15000.00")

    # 13. Savings Goals CRUD
    goal_resp = client.post("/api/v1/savings-goals", headers=headers, json={
        "name": "Goa Family Trip",
        "target_amount": "50000.00",
        "current_amount": "10000.00",
        "notes": "Book flights early"
    })
    assert goal_resp.status_code == 201
    goal = goal_resp.json()

    # Contribute to goal
    contrib_resp = client.post(f"/api/v1/savings-goals/{goal['id']}/contribute", headers=headers, json={
        "amount": "15000.00"
    })
    assert contrib_resp.status_code == 200
    assert Decimal(str(contrib_resp.json()["current_amount"])) == Decimal("25000.00")

    # 14. Loans & Borrowing CRUD
    loan_resp = client.post("/api/v1/loans", headers=headers, json={
        "person_name": "Uncle Suresh",
        "loan_type": "lent",
        "principal_amount": "20000.00",
        "description": "Short-term loan for home repair"
    })
    assert loan_resp.status_code == 201
    loan = loan_resp.json()
    assert Decimal(str(loan["remaining_amount"])) == Decimal("20000.00")

    # Partial repayment
    repay_resp = client.post(f"/api/v1/loans/{loan['id']}/repayment", headers=headers, json={
        "amount": "8000.00"
    })
    assert repay_resp.status_code == 200
    assert Decimal(str(repay_resp.json()["remaining_amount"])) == Decimal("12000.00")
    assert repay_resp.json()["is_settled"] is False
