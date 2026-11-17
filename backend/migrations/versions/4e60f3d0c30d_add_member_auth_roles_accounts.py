"""add_member_auth_roles_accounts"""
from alembic import op
import sqlalchemy as sa

revision = '4e60f3d0c30d'
down_revision = '1e5d3da802ca'
branch_labels = None
depends_on = None

def upgrade():
    # 1. users table updates
    op.add_column('users', sa.Column('role', sa.String(length=20), server_default='member', nullable=False))
    op.add_column('users', sa.Column('household_id', sa.String(length=36), nullable=True))
    op.create_foreign_key('fk_users_household_id', 'users', 'households', ['household_id'], ['id'], ondelete='CASCADE')

    # 2. family_members table updates
    op.add_column('family_members', sa.Column('email', sa.String(length=320), nullable=True))
    op.add_column('family_members', sa.Column('user_id', sa.String(length=36), nullable=True))
    op.add_column('family_members', sa.Column('role', sa.String(length=20), server_default='member', nullable=False))
    op.create_foreign_key('fk_family_members_user_id', 'family_members', 'users', ['user_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_family_members_email', 'family_members', ['email'], unique=False)

    # 3. accounts table updates
    op.add_column('accounts', sa.Column('member_id', sa.String(length=36), nullable=True))
    op.create_foreign_key('fk_accounts_member_id', 'accounts', 'family_members', ['member_id'], ['id'], ondelete='SET NULL')

    # 4. Backfill existing data
    op.execute("""
        UPDATE users
        SET role = 'admin', household_id = households.id
        FROM households
        WHERE households.owner_id = users.id
    """)

    op.execute("""
        UPDATE family_members
        SET email = users.email, user_id = users.id, role = 'admin'
        FROM households, users
        WHERE family_members.household_id = households.id
          AND households.owner_id = users.id
          AND (family_members.relationship_label = 'Self' OR LOWER(family_members.name) = LOWER(users.full_name))
    """)

    op.execute("""
        UPDATE accounts
        SET member_id = family_members.id
        FROM family_members
        WHERE accounts.member_id IS NULL
          AND accounts.household_id = family_members.household_id
          AND family_members.role = 'admin'
    """)

def downgrade():
    op.drop_constraint('fk_accounts_member_id', 'accounts', type_='foreignkey')
    op.drop_column('accounts', 'member_id')

    op.drop_index('ix_family_members_email', table_name='family_members')
    op.drop_constraint('fk_family_members_user_id', 'family_members', type_='foreignkey')
    op.drop_column('family_members', 'role')
    op.drop_column('family_members', 'user_id')
    op.drop_column('family_members', 'email')

    op.drop_constraint('fk_users_household_id', 'users', type_='foreignkey')
    op.drop_column('users', 'household_id')
    op.drop_column('users', 'role')

