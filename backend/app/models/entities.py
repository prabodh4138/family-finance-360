from __future__ import annotations
import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, ForeignKey, Numeric, Boolean, Enum, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"
    transfer = "transfer"

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    household: Mapped["Household"] = relationship(back_populates="owner", uselist=False)

class Household(Base):
    __tablename__ = "households"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    name: Mapped[str] = mapped_column(String(120), default="My Family")
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    owner: Mapped[User] = relationship(back_populates="household")
    members: Mapped[list["FamilyMember"]] = relationship(back_populates="household", cascade="all, delete-orphan")
    accounts: Mapped[list["Account"]] = relationship(back_populates="household", cascade="all, delete-orphan")

class FamilyMember(Base):
    __tablename__ = "family_members"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    relationship_label: Mapped[str] = mapped_column(String(60), default="Other")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    household: Mapped[Household] = relationship(back_populates="members")

class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    account_type: Mapped[str] = mapped_column(String(30), default="cash") # cash, bank, credit_card, wallet, investment
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    household: Mapped[Household] = relationship(back_populates="accounts")

class Category(Base):
    __tablename__ = "categories"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    member_id: Mapped[str | None] = mapped_column(ForeignKey("family_members.id", ondelete="SET NULL"), nullable=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="RESTRICT"))
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    transfer_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    loan_id: Mapped[str | None] = mapped_column(ForeignKey("loans.id", ondelete="SET NULL"), nullable=True)
    transaction_type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    direction: Mapped[str | None] = mapped_column(String(10), nullable=True) # "in" or "out"
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    description: Mapped[str] = mapped_column(String(240))
    transaction_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    client_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    
    member: Mapped[FamilyMember | None] = relationship(foreign_keys=[member_id])
    account: Mapped[Account] = relationship(foreign_keys=[account_id])
    category: Mapped[Category | None] = relationship(foreign_keys=[category_id])
    transfer_account: Mapped[Account | None] = relationship(foreign_keys=[transfer_account_id])
    loan: Mapped[Loan | None] = relationship(foreign_keys=[loan_id])

    __table_args__ = (
        Index("ix_transactions_household_date", "household_id", "transaction_date"),
        Index("uq_transactions_client_request", "household_id", "client_request_id", unique=True),
    )

class Budget(Base):
    __tablename__ = "budgets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(100))
    monthly_limit: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    category: Mapped[Category | None] = relationship()

class SavingsGoal(Base):
    __tablename__ = "savings_goals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    target_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    current_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    target_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Loan(Base):
    __tablename__ = "loans"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    person_name: Mapped[str] = mapped_column(String(120))
    loan_type: Mapped[str] = mapped_column(String(20)) # "lent" or "borrowed"
    principal_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    repaid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    member_id: Mapped[str | None] = mapped_column(ForeignKey("family_members.id", ondelete="SET NULL"), nullable=True)
    account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    is_settled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    member: Mapped[FamilyMember | None] = relationship(foreign_keys=[member_id])
    account: Mapped[Account | None] = relationship(foreign_keys=[account_id])

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    entity_type: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[str] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(30))
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
