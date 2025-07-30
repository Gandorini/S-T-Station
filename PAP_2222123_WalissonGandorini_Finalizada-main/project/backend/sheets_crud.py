import os
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional
from supabase import create_client
from jose import jwt, JWTError
from functools import lru_cache

router = APIRouter()

# --- Supabase Configuration ---
@lru_cache()
def get_supabase_client():
    """Create and return a Supabase client. Uses caching to avoid re-creation."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        raise ValueError("Supabase URL and Key must be set in environment variables.")
    return create_client(url, key)

@lru_cache()
def get_jwt_secret():
    """Get the JWT secret from environment variables. Uses caching."""
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        raise ValueError("JWT secret must be set in environment variables.")
    return secret

# --- Pydantic Models ---
class MusicSheetIn(BaseModel):
    title: str
    composer: str
    instrument: str
    difficulty: str
    tags: Optional[List[str]] = []
    file_url: str
    xml_url: Optional[str] = None
    midi_url: Optional[str] = None
    user_id: Optional[str] = None # Will be overwritten by authenticated user

class MusicSheetOut(MusicSheetIn):
    id: int

# --- Authentication Dependency ---
async def get_current_user(request: Request) -> dict:
    """
    Dependency to get the current user from the JWT token in the Authorization header.
    """
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    try:
        # Expecting "Bearer <token>"
        scheme, _, credentials = token.partition(" ")
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")

        # Use verify=True to ensure the signature is checked
        payload = jwt.decode(credentials, get_jwt_secret(), algorithms=["HS256"], options={"verify_signature": True})
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token: subject missing")
        return {"id": user_id}
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except Exception:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# --- CRUD Endpoints ---
@router.post('/music-sheets/', response_model=MusicSheetOut)
def create_sheet(sheet: MusicSheetIn, user: dict = Depends(get_current_user)):
    supabase = get_supabase_client()

    # Create a dictionary from the model, excluding unset fields to avoid sending nulls
    sheet_data = sheet.dict(exclude_unset=True)
    sheet_data['user_id'] = user["id"] # Enforce user_id from token

    response = supabase.table('music_sheets').insert(sheet_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create sheet in database.")

    return response.data[0]

@router.get('/music-sheets/', response_model=List[MusicSheetOut])
def list_sheets():
    """Lists all music sheets. This endpoint is public."""
    supabase = get_supabase_client()
    response = supabase.table('music_sheets').select("*").order("id", desc=True).execute()
    return response.data

@router.get('/music-sheets/me', response_model=List[MusicSheetOut])
def list_my_sheets(user: dict = Depends(get_current_user)):
    """Lists music sheets belonging to the authenticated user."""
    supabase = get_supabase_client()
    user_id = user["id"]
    response = supabase.table('music_sheets').select("*").eq('user_id', user_id).order("id", desc=True).execute()
    return response.data

@router.get('/music-sheets/{sheet_id}', response_model=MusicSheetOut)
def get_sheet(sheet_id: int):
    """Gets a specific music sheet by its ID. Public."""
    supabase = get_supabase_client()
    response = supabase.table('music_sheets').select("*").eq('id', sheet_id).single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail='Sheet not found')

    return response.data

@router.put('/music-sheets/{sheet_id}', response_model=MusicSheetOut)
def update_sheet(sheet_id: int, sheet: MusicSheetIn, user: dict = Depends(get_current_user)):
    supabase = get_supabase_client()
    user_id = user["id"]

    # First, verify the sheet exists and belongs to the user
    existing_sheet_response = supabase.table('music_sheets').select("id, user_id").eq('id', sheet_id).single().execute()
    if not existing_sheet_response.data:
        raise HTTPException(status_code=404, detail='Sheet not found')
    if existing_sheet_response.data['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="You do not have permission to edit this sheet")

    # Update the sheet
    sheet_data = sheet.dict(exclude_unset=True)
    sheet_data['user_id'] = user_id # Ensure user_id cannot be changed
    response = supabase.table('music_sheets').update(sheet_data).eq('id', sheet_id).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to update sheet.")

    return response.data[0]

@router.delete('/music-sheets/{sheet_id}')
def delete_sheet(sheet_id: int, user: dict = Depends(get_current_user)):
    supabase = get_supabase_client()
    user_id = user["id"]

    # First, verify the sheet exists and belongs to the user
    existing_sheet_response = supabase.table('music_sheets').select("id, user_id").eq('id', sheet_id).single().execute()
    if not existing_sheet_response.data:
        raise HTTPException(status_code=404, detail='Sheet not found')
    if existing_sheet_response.data['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="You do not have permission to delete this sheet")

    # Delete the sheet
    response = supabase.table('music_sheets').delete().eq('id', sheet_id).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to delete sheet.")

    return {'ok': True}