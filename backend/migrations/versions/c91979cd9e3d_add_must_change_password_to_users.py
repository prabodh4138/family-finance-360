"""add_must_change_password_to_users"""
from alembic import op
import sqlalchemy as sa

revision = 'c91979cd9e3d'
down_revision = '4e60f3d0c30d'
branch_labels = None
depends_on = None
def upgrade():
    op.add_column(
        'users',
        sa.Column('must_change_password', sa.Boolean(), server_default=sa.text('false'), nullable=False)
    )

def downgrade():
    op.drop_column('users', 'must_change_password')
