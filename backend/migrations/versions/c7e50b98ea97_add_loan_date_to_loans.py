"""add_loan_date_to_loans"""
from alembic import op
import sqlalchemy as sa

revision = 'c7e50b98ea97'
down_revision = 'c91979cd9e3d'
branch_labels = None
depends_on = None
def upgrade():
    op.add_column(
        'loans',
        sa.Column('loan_date', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)
    )

def downgrade():
    op.drop_column('loans', 'loan_date')
