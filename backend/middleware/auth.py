import jwt
import os
from functools import wraps
from flask import request, jsonify
from dotenv import load_dotenv

load_dotenv()

SECRET = os.getenv("JWT_SECRET")

def token_required(f):
    """
    Decorator that checks if a valid JWT token is present.
    Usage: add @token_required above any route that needs login.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # Get token from header
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "")

        if not token:
            return jsonify({"error": "Token missing. Please login."}), 401

        try:
            # Decode and verify token
            payload = jwt.decode(token, SECRET, algorithms=["HS256"])
            request.user = payload  # attach user info to request
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired. Please login again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token. Please login."}), 401

        return f(*args, **kwargs)
    return decorated


def role_required(allowed_roles):
    """
    Decorator that checks if user has the right role.
    Usage: @role_required(['doctor', 'admin'])
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user_role = request.user.get("role")
            if user_role not in allowed_roles:
                return jsonify({
                    "error": f"Access denied. Required role: {allowed_roles}"
                }), 403
            return f(*args, **kwargs)
        return decorated
    return decorator