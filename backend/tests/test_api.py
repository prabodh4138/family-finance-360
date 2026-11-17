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

def test_family_member_accounts_auth_and_admin_controls():
    uid = uuid.uuid4().hex[:8]
    admin_email = f"admin_{uid}@example.com"
    admin_pass = "AdminPass123!"

    # 1. Register Admin
    reg = client.post("/api/v1/auth/register", json={
        "email": admin_email,
        "full_name": "Prabodh Admin",
        "password": admin_pass,
        "household_name": "Rana Family"
    })
    assert reg.status_code == 201
    admin_token = reg.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Verify admin role
    me_resp = client.get("/api/v1/auth/me", headers=admin_headers)
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["role"] == "admin"
    assert me_data["household_name"] == "Rana Family"

    # 2. Admin adds family member Avimanyu with email, password, and initial account
    avi_email = f"avimanyu_{uid}@example.com"
    avi_pass = "AviInitialPass123!"
    add_member_resp = client.post("/api/v1/members", headers=admin_headers, json={
        "name": "Avimanyu",
        "relationship_label": "Son",
        "email": avi_email,
        "role": "member",
        "initial_password": avi_pass,
        "initial_account_name": "Avimanyu SBI Savings",
        "initial_account_type": "bank",
        "initial_account_balance": "25000.00"
    })
    assert add_member_resp.status_code == 201
    avi_member = add_member_resp.json()
    assert avi_member["email"] == avi_email
    assert avi_member["role"] == "member"
    assert avi_member["account_count"] == 1
    assert Decimal(str(avi_member["total_balance"])) == Decimal("25000.00")

    # 3. Avimanyu signs in directly using his email and initial password!
    login_resp = client.post("/api/v1/auth/login", json={
        "email": avi_email,
        "password": avi_pass
    })
    assert login_resp.status_code == 200
    avi_token = login_resp.json()["access_token"]
    avi_headers = {"Authorization": f"Bearer {avi_token}"}

    # Avimanyu can access the family household data
    avi_me = client.get("/api/v1/auth/me", headers=avi_headers).json()
    assert avi_me["role"] == "member"
    assert avi_me["household_id"] == me_data["household_id"]

    # Member cannot do admin actions (like resetting other member passwords)
    forbidden_resp = client.post(f"/api/v1/members/{avi_member['id']}/reset-password", headers=avi_headers, json={
        "new_password": "HackerPassword!"
    })
    assert forbidden_resp.status_code == 403

    # 4. Admin resets Avimanyu's password without touching DB
    new_avi_pass = "AviNewSecretPass789!"
    reset_resp = client.post(f"/api/v1/members/{avi_member['id']}/reset-password", headers=admin_headers, json={
        "new_password": new_avi_pass
    })
    assert reset_resp.status_code == 200

    # Old password no longer works
    fail_login = client.post("/api/v1/auth/login", json={
        "email": avi_email,
        "password": avi_pass
    })
    assert fail_login.status_code == 401

    # New password works perfectly
    new_login = client.post("/api/v1/auth/login", json={
        "email": avi_email,
        "password": new_avi_pass
    })
    assert new_login.status_code == 200

    # 5. Combined Balance & Individual Balance in Dashboard
    summary_resp = client.get("/api/v1/dashboard/summary", headers=admin_headers)
    assert summary_resp.status_code == 200
    summary = summary_resp.json()

    # Avimanyu has 25,000, Cash and Primary Bank have 0.00 -> Combined Balance is at least 25,000.00
    assert Decimal(str(summary["combined_balance"])) >= Decimal("25000.00")
    assert len(summary["member_balances"]) >= 2 # Prabodh + Avimanyu

    avi_bal = next(m for m in summary["member_balances"] if m["member_id"] == avi_member["id"])
    assert Decimal(str(avi_bal["total_balance"])) == Decimal("25000.00")
    assert avi_bal["accounts"][0]["name"] == "Avimanyu SBI Savings"
    assert Decimal(str(avi_bal["accounts"][0]["current_balance"])) == Decimal("25000.00")

    # 6. Admin Household update & Audit Logs
    up_h = client.put("/api/v1/admin/household", headers=admin_headers, json={
        "name": "Rana Royal Family",
        "currency": "INR"
    })
    assert up_h.status_code == 200
    assert up_h.json()["name"] == "Rana Royal Family"

    audit_logs = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert audit_logs.status_code == 200
    assert len(audit_logs.json()) >= 2


def test_mandatory_password_change_and_opening_balance_update():
    admin_email = f"admin_pw_{uuid.uuid4().hex[:6]}@family.org"
    reg = client.post("/api/v1/auth/register", json={
        "email": admin_email,
        "full_name": "Admin Tester",
        "password": "AdminPassword123!",
        "household_name": "Test Household"
    })
    assert reg.status_code == 201
    admin_token = reg.json()["access_token"]
    assert reg.json()["must_change_password"] is False
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create Account with 0.00 opening balance
    acc_res = client.post("/api/v1/accounts", headers=admin_headers, json={
        "name": "Sanjukta SBI 7378",
        "account_type": "bank",
        "opening_balance": "0.00"
    })
    assert acc_res.status_code == 201
    acc_id = acc_res.json()["id"]
    assert Decimal(str(acc_res.json()["opening_balance"])) == Decimal("0.00")
    assert Decimal(str(acc_res.json()["current_balance"])) == Decimal("0.00")

    # 2. Update opening balance using PUT
    up_put = client.put(f"/api/v1/accounts/{acc_id}", headers=admin_headers, json={
        "opening_balance": "35000.00"
    })
    assert up_put.status_code == 200
    assert Decimal(str(up_put.json()["opening_balance"])) == Decimal("35000.00")
    assert Decimal(str(up_put.json()["current_balance"])) == Decimal("35000.00")

    # 3. Update opening balance using PATCH
    up_patch = client.patch(f"/api/v1/accounts/{acc_id}", headers=admin_headers, json={
        "opening_balance": "42000.00"
    })
    assert up_patch.status_code == 200
    assert Decimal(str(up_patch.json()["opening_balance"])) == Decimal("42000.00")
    assert Decimal(str(up_patch.json()["current_balance"])) == Decimal("42000.00")

    # 4. Admin adds family member with temporary initial password
    sanjukta_email = f"sanjukta_{uuid.uuid4().hex[:6]}@family.org"
    temp_pass = "TempPassword123!"
    add_mem = client.post("/api/v1/members", headers=admin_headers, json={
        "name": "Sanjukta",
        "relationship_label": "Wife",
        "email": sanjukta_email,
        "role": "member",
        "initial_password": temp_pass
    })
    assert add_mem.status_code == 201

    # 5. Sanjukta logs in with temporary password -> must_change_password is True
    sanjukta_login = client.post("/api/v1/auth/login", json={
        "email": sanjukta_email,
        "password": temp_pass
    })
    assert sanjukta_login.status_code == 200
    assert sanjukta_login.json()["must_change_password"] is True
    sanjukta_token = sanjukta_login.json()["access_token"]
    sanjukta_headers = {"Authorization": f"Bearer {sanjukta_token}"}

    # Verify /auth/me returns must_change_password: True
    me_resp = client.get("/api/v1/auth/me", headers=sanjukta_headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["must_change_password"] is True

    # 6. Sanjukta changes password to new secure password
    new_pass = "SanjuktaSecure789!"
    change_resp = client.post("/api/v1/auth/change-password", headers=sanjukta_headers, json={
        "new_password": new_pass
    })
    assert change_resp.status_code == 200

    # Verify /auth/me now returns must_change_password: False
    me_after = client.get("/api/v1/auth/me", headers=sanjukta_headers)
    assert me_after.status_code == 200
    assert me_after.json()["must_change_password"] is False

    # 7. Old password no longer works
    old_fail = client.post("/api/v1/auth/login", json={
        "email": sanjukta_email,
        "password": temp_pass
    })
    assert old_fail.status_code == 401

    # 8. New password logs in with must_change_password: False
    login_new = client.post("/api/v1/auth/login", json={
        "email": sanjukta_email,
        "password": new_pass
    })
    assert login_new.status_code == 200
    assert login_new.json()["must_change_password"] is False

    # 9. Admin resets Sanjukta password -> sets must_change_password back to True
    reset_temp = "AnotherTempPass999!"
    reset_resp = client.post(f"/api/v1/members/{add_mem.json()['id']}/reset-password", headers=admin_headers, json={
        "new_password": reset_temp
    })
    assert reset_resp.status_code == 200

    login_after_reset = client.post("/api/v1/auth/login", json={
        "email": sanjukta_email,
        "password": reset_temp
    })
    assert login_after_reset.status_code == 200
    assert login_after_reset.json()["must_change_password"] is True

