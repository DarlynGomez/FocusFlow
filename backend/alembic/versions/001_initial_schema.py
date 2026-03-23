"""Initial schema: users, documents, pages, blocks, chunks, embeddings, sessions, events, support_messages.

Revision ID: 001
Revises:
Create Date: 2025-03-15

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("original_filename", sa.String(512), nullable=False),
        sa.Column("file_path", sa.String(1024), nullable=False),
        sa.Column("status", sa.Enum("uploaded", "processing", "ready", "failed", name="documentstatus"), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_documents_user_id", "documents", ["user_id"])

    op.create_table(
        "document_pages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("width", sa.Float(), nullable=True),
        sa.Column("height", sa.Float(), nullable=True),
    )
    op.create_index("ix_document_pages_document_id", "document_pages", ["document_id"])

    op.create_table(
        "document_blocks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("block_index", sa.Integer(), nullable=False),
        sa.Column("block_type_guess", sa.String(64), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("bbox_x0", sa.Float(), nullable=True),
        sa.Column("bbox_y0", sa.Float(), nullable=True),
        sa.Column("bbox_x1", sa.Float(), nullable=True),
        sa.Column("bbox_y1", sa.Float(), nullable=True),
        sa.Column("font_size_guess", sa.Float(), nullable=True),
        sa.Column("reading_order", sa.Integer(), nullable=False),
    )
    op.create_index("ix_document_blocks_document_id", "document_blocks", ["document_id"])

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("page_start", sa.Integer(), nullable=False),
        sa.Column("page_end", sa.Integer(), nullable=False),
        sa.Column("section_title", sa.String(512), nullable=True),
        sa.Column("parent_section_title", sa.String(512), nullable=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("key_idea", sa.Text(), nullable=True),
        sa.Column("why_it_matters", sa.Text(), nullable=True),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("simplified_text", sa.Text(), nullable=True),
        sa.Column("estimated_read_time_seconds", sa.Integer(), nullable=True),
        sa.Column("difficulty_score", sa.Float(), nullable=True),
        sa.Column("reading_order", sa.Integer(), nullable=False),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])

    op.create_table(
        "chunk_embeddings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("chunk_id", sa.String(36), sa.ForeignKey("document_chunks.id"), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
    )
    op.create_index("ix_chunk_embeddings_chunk_id", "chunk_embeddings", ["chunk_id"], unique=True)

    op.create_table(
        "reading_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_active_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("current_chunk_id", sa.String(36), sa.ForeignKey("document_chunks.id"), nullable=True),
        sa.Column("support_mode", sa.String(32), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_reading_sessions_user_id", "reading_sessions", ["user_id"])
    op.create_index("ix_reading_sessions_document_id", "reading_sessions", ["document_id"])

    op.create_table(
        "reading_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("reading_sessions.id"), nullable=False),
        sa.Column("chunk_id", sa.String(36), sa.ForeignKey("document_chunks.id"), nullable=True),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("event_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_reading_events_session_id", "reading_events", ["session_id"])

    op.create_table(
        "support_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("reading_sessions.id"), nullable=False),
        sa.Column("chunk_id", sa.String(36), sa.ForeignKey("document_chunks.id"), nullable=True),
        sa.Column("support_type", sa.String(64), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("trigger_source", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_support_messages_session_id", "support_messages", ["session_id"])


def downgrade() -> None:
    op.drop_table("support_messages")
    op.drop_table("reading_events")
    op.drop_table("reading_sessions")
    op.drop_table("chunk_embeddings")
    op.drop_table("document_chunks")
    op.drop_table("document_blocks")
    op.drop_table("document_pages")
    op.drop_table("documents")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS documentstatus")
