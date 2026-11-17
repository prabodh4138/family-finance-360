"""add_transfer_loan_ledger_fields"""
from alembic import op
import sqlalchemy as sa

revision = '1e5d3da802ca'
down_revision = 'd01237c97103'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('loans', sa.Column('member_id', sa.String(length=36), nullable=True))
    op.add_column('loans', sa.Column('account_id', sa.String(length=36), nullable=True))
    op.create_foreign_key('fk_loans_account_id', 'loans', 'accounts', ['account_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_loans_member_id', 'loans', 'family_members', ['member_id'], ['id'], ondelete='SET NULL')
    op.add_column('transactions', sa.Column('transfer_account_id', sa.String(length=36), nullable=True))
    op.add_column('transactions', sa.Column('loan_id', sa.String(length=36), nullable=True))
    op.add_column('transactions', sa.Column('direction', sa.String(length=10), nullable=True))
    op.create_foreign_key('fk_transactions_transfer_account_id', 'transactions', 'accounts', ['transfer_account_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_transactions_loan_id', 'transactions', 'loans', ['loan_id'], ['id'], ondelete='SET NULL')

def downgrade():
    op.drop_constraint('fk_transactions_loan_id', 'transactions', type_='foreignkey')
    op.drop_constraint('fk_transactions_transfer_account_id', 'transactions', type_='foreignkey')
    op.drop_column('transactions', 'direction')
    op.drop_column('transactions', 'loan_id')
    op.drop_column('transactions', 'transfer_account_id')
    op.drop_constraint('fk_loans_member_id', 'loans', type_='foreignkey')
    op.drop_constraint('fk_loans_account_id', 'loans', type_='foreignkey')
    op.drop_column('loans', 'account_id')
    op.drop_column('loans', 'member_id')
