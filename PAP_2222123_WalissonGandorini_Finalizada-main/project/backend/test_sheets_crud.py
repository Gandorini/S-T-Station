import os
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

# Set environment variables for testing before importing the app
os.environ['SUPABASE_URL'] = 'http://test.supabase.co'
os.environ['SUPABASE_ANON_KEY'] = 'test_anon_key'
os.environ['SUPABASE_JWT_SECRET'] = 'test_jwt_secret'
os.environ['SUPABASE_ROLE_KEY'] = 'test_role_key'

from main import app

client = TestClient(app)

@pytest.fixture
def mock_supabase_client():
    """Mocks the Supabase client to avoid making real database calls."""
    with patch('sheets_crud.get_supabase_client') as mock_get_client:
        # This is a basic mock. More complex tests would need a more detailed mock object.
        mock_client = mock_get_client.return_value
        yield mock_client

def test_list_sheets_public_endpoint(mock_supabase_client):
    """
    Tests the public GET /music-sheets/ endpoint.
    It should return a 200 OK status.
    """
    # Arrange: Mock the database response
    mock_supabase_client.table.return_value.select.return_value.order.return_value.execute.return_value.data = [
        {"id": 1, "title": "Test Sheet 1", "composer": "Tester", "instrument": "Piano", "difficulty": "Easy", "file_url": "http://example.com/sheet1.pdf"},
        {"id": 2, "title": "Test Sheet 2", "composer": "Tester", "instrument": "Guitar", "difficulty": "Hard", "file_url": "http://example.com/sheet2.pdf"},
    ]

    # Act: Make a request to the endpoint
    response = client.get("/music-sheets/")

    # Assert: Check the status code and response body
    assert response.status_code == 200

    response_data = response.json()
    assert isinstance(response_data, list)
    assert len(response_data) == 2
    assert response_data[0]["title"] == "Test Sheet 1"

def test_get_sheet_by_id_not_found(mock_supabase_client):
    """
    Tests getting a single sheet that does not exist.
    It should return a 404 Not Found status.
    """
    # Arrange: Mock the database response for a non-existent sheet
    mock_supabase_client.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = None

    # Act
    response = client.get("/music-sheets/999")

    # Assert
    assert response.status_code == 404
    assert response.json()["detail"] == "Sheet not found"

def test_create_sheet_requires_auth(mock_supabase_client):
    """
    Tests that creating a sheet requires authentication.
    It should return a 401 Unauthorized status without a token.
    """
    # Act
    response = client.post("/music-sheets/", json={
        "title": "New Sheet",
        "composer": "No Auth",
        "instrument": "Triangle",
        "difficulty": "Easy",
        "file_url": "http://example.com/no-auth.pdf"
    })

    # Assert
    assert response.status_code == 401
    assert response.json()["detail"] == "Authorization header missing"

# To run these tests, navigate to the `project/backend` directory and run `pytest`.
# You will need to have the testing dependencies installed: `pip install pytest httpx`
