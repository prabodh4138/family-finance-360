import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_production_modifications_lifecycle():
    # 1. Register User & Household
    uid = uuid.uuid4().hex[:8]
    test_email = f"prabodh_{uid}@example.com"
    test_password = "SecurePassword123!"
    reg_resp = client.post("/api/v1/auth/register", json={
        "email": test_email,
        "full_name": "Prabodh Kumar",
        "password": test_password,
        "household_name": "Kumar Household"
    })
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Accounts (Cash and Primary Bank Account created with 0.00 opening balance)
    accs = client.get("/api/v1/accounts", headers=headers).json()
    cash_acc = next(a for a in accs if "Cash" in a["name"])
    bank_acc = next(a for a in accs if "Bank" in a["name"])

    # 3. Add Family Members: Prabodh and Priya
    m_prabodh = client.get("/api/v1/members", headers=headers).json()[0] # Self
    m_priya = client.post("/api/v1/members", headers=headers, json={
        "name": "Priya",
        "relationship_label": "Spouse"
    }).json()

    # -------------------------------------------------------------
    # REQUIREMENT 1: Account balance CANNOT be negative
    # -------------------------------------------------------------
    # Trying to spend ₹1,000 from Cash (which has 0.00) MUST fail with 422
    neg_tx_resp = client.post("/api/v1/transactions", headers=headers, json={
        "account_id": cash_acc["id"],
        "transaction_type": "expense",
        "amount": "1000.00",
        "description": "Attempt to overdraft Cash",
        "transaction_date": datetime.now(timezone.utc).isoformat()
    })
    assert neg_tx_resp.status_code == 422
    assert "Account balance cannot be negative" in neg_tx_resp.json()["detail"]

    # Deposit ₹50,000 into Bank Account
    salary_cat = next(c for c in client.get("/api/v1/categories", headers=headers).json() if "Salary" in c["name"])
    client.post("/api/v1/transactions", headers=headers, json={
        "account_id": bank_acc["id"],
        "member_id": m_prabodh["id"],
        "category_id": salary_cat["id"],
        "transaction_type": "income",
        "amount": "50000.00",
        "description": "Monthly Salary Deposit",
        "transaction_date": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    })

    # Bank balance is now 50,000
    acc_check = client.get("/api/v1/accounts", headers=headers).json()
    bank_updated = next(a for a in acc_check if a["id"] == bank_acc["id"])
    assert Decimal(str(bank_updated["current_balance"])) == Decimal("50000.00")

    # -------------------------------------------------------------
    # REQUIREMENT 2: Fund transfer between accounts
    # -------------------------------------------------------------
    # Attempting to transfer ₹60,000 from Bank (only has 50,000) MUST fail with 422
    fail_transfer = client.post("/api/v1/accounts/transfer", headers=headers, json={
        "from_account_id": bank_acc["id"],
        "to_account_id": cash_acc["id"],
        "amount": "60000.00",
        "description": "ATM cash withdrawal",
        "transaction_date": (datetime.now(timezone.utc) - timedelta(days=4)).isoformat()
    })
    assert fail_transfer.status_code == 422
    assert "Insufficient balance" in fail_transfer.json()["detail"]

    # Valid Transfer: ₹15,000 from Bank to Cash
    success_transfer = client.post("/api/v1/accounts/transfer", headers=headers, json={
        "from_account_id": bank_acc["id"],
        "to_account_id": cash_acc["id"],
        "amount": "15000.00",
        "description": "ATM cash withdrawal",
        "transaction_date": (datetime.now(timezone.utc) - timedelta(days=4)).isoformat()
    })
    assert success_transfer.status_code == 201
    transfer_data = success_transfer.json()
    assert Decimal(str(transfer_data["from_account_balance"])) == Decimal("35000.00") # 50000 - 15000
    assert Decimal(str(transfer_data["to_account_balance"])) == Decimal("15000.00") # 0 + 15000

    # -------------------------------------------------------------
    # REQUIREMENT 3: Prabodh lends to Avimanyu -> debited, returned -> credited to Prabodh or Priya
    # -------------------------------------------------------------
    # Prabodh gives a loan of ₹10,000 to Avimanyu from Bank Account
    loan_resp = client.post("/api/v1/loans", headers=headers, json={
        "person_name": "Avimanyu",
        "loan_type": "lent",
        "principal_amount": "10000.00",
        "account_id": bank_acc["id"],
        "member_id": m_prabodh["id"],
        "description": "Friend emergency loan"
    })
    assert loan_resp.status_code == 201
    loan = loan_resp.json()
    assert Decimal(str(loan["remaining_amount"])) == Decimal("10000.00")

    # Bank balance was 35,000, now should be debited by 10,000 -> 25,000!
    acc_check2 = client.get("/api/v1/accounts", headers=headers).json()
    bank_after_loan = next(a for a in acc_check2 if a["id"] == bank_acc["id"])
    assert Decimal(str(bank_after_loan["current_balance"])) == Decimal("25000.00")

    # Avimanyu returns ₹6,000, credited to Priya's Cash account as per choice!
    repay_resp = client.post(f"/api/v1/loans/{loan['id']}/repayment", headers=headers, json={
        "amount": "6000.00",
        "account_id": cash_acc["id"], # Deposited into Cash
        "member_id": m_priya["id"],  # Credited to Priya
        "notes": "Avimanyu UPI transfer to Priya"
    })
    assert repay_resp.status_code == 200
    repay_data = repay_resp.json()
    assert Decimal(str(repay_data["remaining_amount"])) == Decimal("4000.00") # 10000 - 6000

    # Cash account had 15,000, now should be credited by 6,000 -> 21,000!
    acc_check3 = client.get("/api/v1/accounts", headers=headers).json()
    cash_after_repay = next(a for a in acc_check3 if a["id"] == cash_acc["id"])
    assert Decimal(str(cash_after_repay["current_balance"])) == Decimal("21000.00")

    # -------------------------------------------------------------
    # REQUIREMENT 4: Bank Statement / Ledger with Available Balance & Date Range
    # -------------------------------------------------------------
    from_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    to_date = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")

    # Get statement for Bank Account
    bank_stmt_resp = client.get(f"/api/v1/accounts/{bank_acc['id']}/statement?from_date={from_date}&to_date={to_date}", headers=headers)
    assert bank_stmt_resp.status_code == 200
    stmt = bank_stmt_resp.json()
    assert stmt["account_name"] == bank_acc["name"]
    assert Decimal(str(stmt["opening_balance"])) == Decimal("0.00")
    assert Decimal(str(stmt["total_credits"])) == Decimal("50000.00") # Salary deposit
    assert Decimal(str(stmt["total_debits"])) == Decimal("25000.00") # 15000 transfer out + 10000 loan lent
    assert Decimal(str(stmt["closing_balance"])) == Decimal("25000.00")
    assert len(stmt["entries"]) == 3

    # Check chronological running balance on Bank Statement
    entries = stmt["entries"]
    # 1. Salary Deposit (+50,000 -> balance 50,000)
    assert entries[0]["entry_type"] == "credit"
    assert Decimal(str(entries[0]["running_balance"])) == Decimal("50000.00")
    # 2. Transfer Out (-15,000 -> balance 35,000)
    assert entries[1]["entry_type"] == "debit"
    assert Decimal(str(entries[1]["running_balance"])) == Decimal("35000.00")
    # 3. Loan Lent (-10,000 -> balance 25,000)
    assert entries[2]["entry_type"] == "debit"
    assert Decimal(str(entries[2]["running_balance"])) == Decimal("25000.00")

    # Test statement CSV export
    stmt_csv = client.get(f"/api/v1/accounts/{bank_acc['id']}/statement/export/csv?from_date={from_date}&to_date={to_date}", headers=headers)
    assert stmt_csv.status_code == 200
    assert "text/csv" in stmt_csv.headers["content-type"]
    assert "Available Balance" in stmt_csv.text
