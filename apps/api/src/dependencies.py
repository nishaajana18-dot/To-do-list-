from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from packages.core.src.database import get_db
from packages.core.src.models import Project


def get_project_or_404(project_id: UUID, db: Session = Depends(get_db)) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )
    return project
