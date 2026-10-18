"""
MarketMint — Local AI Marketing Assistant
Backend Flask Application

MarketMint runs 100% locally using open-weight AI via Ollama (defaulting to gemma2:2b).
No external API keys, no paid subscriptions, and no data leaves your machine.
"""

import os
import json
import logging
from datetime import datetime, timezone
import requests
from flask import Flask, render_template, request, jsonify

# Load optional .env file if python-dotenv is present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Configure application logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("MarketMint")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # 1MB max payload

# Configuration from Environment
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "gemma2:2b")
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "90"))
FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "False").lower() in ("true", "1", "yes")

# Allowed generator options
ALLOWED_GENERATOR_TYPES = {"product", "whatsapp", "social"}
ALLOWED_PLATFORMS = {"instagram", "facebook", "general"}
ALLOWED_LANGUAGES = {"English", "Hindi", "Telugu", "Tamil"}
ALLOWED_TONES = {"Friendly", "Professional", "Playful", "Persuasive", "Minimal"}

SYSTEM_PROMPT = """You are MarketMint, an expert ethical marketing copywriter for small business owners, local shops, and freelancers.

CRITICAL OPERATIONAL RULES:
1. TRUTHFULNESS: Only use the exact facts, specifications, and details provided by the user.
2. ZERO FABRICATION: Do NOT invent discounts, promotional deadlines, scarcity claims, certifications, customer reviews, or unverified technical specifications.
3. CLEAR FORMATTING: Format the marketing copy with clean headings, readable paragraphs, bullet points, and a distinct Call to Action.
4. AUTHENTIC VOICE: Keep the tone natural, engaging, and appropriate for small business customers.
5. LANGUAGE FIDELITY: If a specific regional language is requested (such as Hindi, Telugu, or Tamil), write in that language using clear, modern phrasing.
"""


def check_ollama_status():
    """
    Check if the local Ollama instance is reachable and query installed models.
    Returns:
        dict: {
            "connected": bool,
            "installed_models": list of str,
            "error": str or None
        }
    """
    tags_url = f"{OLLAMA_HOST}/api/tags"
    try:
        response = requests.get(tags_url, timeout=4)
        if response.status_code == 200:
            data = response.json()
            models_list = [m.get("name", "") for m in data.get("models", [])]
            return {
                "connected": True,
                "installed_models": models_list,
                "error": None
            }
        else:
            return {
                "connected": False,
                "installed_models": [],
                "error": f"Ollama returned HTTP {response.status_code}"
            }
    except requests.exceptions.ConnectionError:
        return {
            "connected": False,
            "installed_models": [],
            "error": "Ollama is not running. Please launch Ollama on your system."
        }
    except requests.exceptions.Timeout:
        return {
            "connected": False,
            "installed_models": [],
            "error": "Connection to Ollama timed out."
        }
    except Exception as exc:
        return {
            "connected": False,
            "installed_models": [],
            "error": f"Failed to connect to Ollama: {str(exc)}"
        }


def build_product_prompt(data):
    """Construct prompt for product description generator."""
    product_name = data.get("product_name", "").strip()
    category = data.get("category", "").strip() or "General"
    features = data.get("features", "").strip()
    audience = data.get("audience", "").strip() or "General customers"
    price = data.get("price", "").strip()
    language = data.get("language", "English")
    tone = data.get("tone", "Friendly")

    prompt = (
        f"Generate a professional marketing package for the following product:\n\n"
        f"Product Name: {product_name}\n"
        f"Category: {category}\n"
        f"Key Features & Details: {features}\n"
        f"Target Audience: {audience}\n"
    )
    if price:
        prompt += f"Price: {price}\n"
    prompt += (
        f"Language: {language}\n"
        f"Writing Tone: {tone}\n\n"
        f"Please provide:\n"
        f"1. An attractive, catchy Product Title\n"
        f"2. A persuasive, clear Product Description (1 to 2 paragraphs)\n"
        f"3. 3 to 5 Key Selling Points (bullet points based ONLY on the provided features)\n"
        f"4. A short, compelling Call to Action (CTA)\n\n"
        f"Remember: Do not invent any discounts, guarantees, or certifications not mentioned above."
    )
    return prompt


def build_whatsapp_prompt(data):
    """Construct prompt for WhatsApp promotional message generator."""
    product_service = data.get("product_service", "").strip()
    offer_details = data.get("offer_details", "").strip()
    audience = data.get("audience", "").strip() or "General contacts and customers"
    language = data.get("language", "English")
    tone = data.get("tone", "Friendly")

    prompt = (
        f"Write a ready-to-send WhatsApp promotional message for:\n\n"
        f"Product/Service: {product_service}\n"
        f"Promotion / Details: {offer_details}\n"
        f"Target Audience: {audience}\n"
        f"Language: {language}\n"
        f"Tone: {tone}\n\n"
        f"Requirements:\n"
        f"- Start with a warm, friendly opening suited for WhatsApp messaging.\n"
        f"- Highlight the real benefits and details provided above.\n"
        f"- Include a clear, easy Call to Action (e.g. 'Reply to order' or 'Message us back').\n"
        f"- Use emojis naturally but sparingly (do not spam).\n"
        f"- Keep paragraphs brief and easy to read on mobile screens.\n"
        f"- STRICT RULE: Do not invent any fake discounts, countdown deadlines, or scarcity claims."
    )
    return prompt


def build_social_prompt(data):
    """Construct prompt for social media caption generator."""
    product_topic = data.get("product_topic", "").strip()
    platform = data.get("platform", "general").lower()
    details = data.get("details", "").strip()
    audience = data.get("audience", "").strip() or "Followers and general audience"
    language = data.get("language", "English")
    tone = data.get("tone", "Friendly")

    platform_labels = {
        "instagram": "Instagram (punchy hook, clean line breaks, visually appealing)",
        "facebook": "Facebook (conversational, community-oriented, engaging story)",
        "general": "General Social Media (versatile, clear, engaging)"
    }
    platform_desc = platform_labels.get(platform, "General Social Media")

    prompt = (
        f"Create an engaging social media post for:\n\n"
        f"Platform: {platform_desc}\n"
        f"Product / Topic: {product_topic}\n"
        f"Key Highlights & Details: {details}\n"
        f"Target Audience: {audience}\n"
        f"Language: {language}\n"
        f"Tone: {tone}\n\n"
        f"Requirements:\n"
        f"- An attention-grabbing first line (hook).\n"
        f"- An engaging caption body that communicates authentic value.\n"
        f"- A clear Call to Action tailored to the platform.\n"
        f"- 5 to 8 relevant, high-quality hashtags (no excessive hashtag spam).\n"
        f"- STRICT RULE: No exaggerated claims or invented facts."
    )
    return prompt


@app.route("/")
def index():
    """Render the single-page application dashboard."""
    return render_template("index.html", default_model=DEFAULT_MODEL)


@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Health check endpoint reporting Flask status and Ollama connectivity.
    """
    ollama_info = check_ollama_status()
    installed = ollama_info["installed_models"]
    connected = ollama_info["connected"]

    # Check if the configured model is installed (matching exact name or prefix)
    is_model_installed = any(
        m == DEFAULT_MODEL or m.startswith(f"{DEFAULT_MODEL}:")
        for m in installed
    )

    if connected and is_model_installed:
        status = "healthy"
        message = f"Ollama is running with '{DEFAULT_MODEL}' ready."
    elif connected and not is_model_installed:
        status = "warning"
        message = (
            f"Ollama is running, but model '{DEFAULT_MODEL}' is not installed. "
            f"Run 'ollama pull {DEFAULT_MODEL}' in your terminal."
        )
    else:
        status = "error"
        message = ollama_info["error"] or "Could not connect to Ollama."

    return jsonify({
        "status": status,
        "ollama_connected": connected,
        "configured_model": DEFAULT_MODEL,
        "model_available": is_model_installed,
        "installed_models": installed,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }), (200 if connected else 503)


@app.route("/api/models", methods=["GET"])
def list_models():
    """Return the list of installed Ollama models."""
    ollama_info = check_ollama_status()
    return jsonify({
        "connected": ollama_info["connected"],
        "models": ollama_info["installed_models"],
        "default_model": DEFAULT_MODEL,
        "error": ollama_info["error"]
    })


@app.route("/api/generate", methods=["POST"])
def generate():
    """
    Generate marketing content using local Ollama model.
    Accepts JSON with generator type and inputs.
    """
    if not request.is_json:
        return jsonify({
            "success": False,
            "error": "Invalid request format. Content-Type must be application/json."
        }), 400

    data = request.get_json()
    gen_type = data.get("type", "").strip().lower()

    if gen_type not in ALLOWED_GENERATOR_TYPES:
        return jsonify({
            "success": False,
            "error": f"Invalid generation type. Must be one of: {', '.join(ALLOWED_GENERATOR_TYPES)}"
        }), 400

    # Input validation based on generator type
    language = data.get("language", "English")
    if language not in ALLOWED_LANGUAGES:
        language = "English"

    tone = data.get("tone", "Friendly")
    if tone not in ALLOWED_TONES:
        tone = "Friendly"

    # Requested model (defaults to DEFAULT_MODEL)
    requested_model = data.get("model", "").strip() or DEFAULT_MODEL

    if gen_type == "product":
        product_name = data.get("product_name", "").strip()
        features = data.get("features", "").strip()
        if not product_name:
            return jsonify({"success": False, "error": "Product name is required."}), 400
        if len(product_name) > 150:
            return jsonify({"success": False, "error": "Product name must be under 150 characters."}), 400
        if not features:
            return jsonify({"success": False, "error": "Key features are required to generate accurate copy."}), 400
        if len(features) > 2000:
            return jsonify({"success": False, "error": "Features text is too long (max 2000 characters)."}), 400
        user_prompt = build_product_prompt(data)

    elif gen_type == "whatsapp":
        product_service = data.get("product_service", "").strip()
        offer_details = data.get("offer_details", "").strip()
        if not product_service:
            return jsonify({"success": False, "error": "Product or service name is required."}), 400
        if len(product_service) > 150:
            return jsonify({"success": False, "error": "Product/service name must be under 150 characters."}), 400
        if not offer_details:
            return jsonify({"success": False, "error": "Promotion or offer details are required."}), 400
        if len(offer_details) > 2000:
            return jsonify({"success": False, "error": "Details text is too long (max 2000 characters)."}), 400
        user_prompt = build_whatsapp_prompt(data)

    elif gen_type == "social":
        product_topic = data.get("product_topic", "").strip()
        platform = data.get("platform", "general").lower()
        details = data.get("details", "").strip()
        if not product_topic:
            return jsonify({"success": False, "error": "Product or topic title is required."}), 400
        if len(product_topic) > 150:
            return jsonify({"success": False, "error": "Product/topic must be under 150 characters."}), 400
        if platform not in ALLOWED_PLATFORMS:
            return jsonify({"success": False, "error": f"Invalid platform. Must be one of: {', '.join(ALLOWED_PLATFORMS)}"}), 400
        if not details:
            return jsonify({"success": False, "error": "Post details and highlights are required."}), 400
        if len(details) > 2000:
            return jsonify({"success": False, "error": "Details text is too long (max 2000 characters)."}), 400
        user_prompt = build_social_prompt(data)

    # Call Ollama API
    chat_url = f"{OLLAMA_HOST}/api/chat"
    payload = {
        "model": requested_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        "stream": False,
        "options": {
            "temperature": 0.6,
            "top_p": 0.9
        }
    }

    try:
        logger.info(f"Generating '{gen_type}' content using model '{requested_model}'...")
        response = requests.post(chat_url, json=payload, timeout=OLLAMA_TIMEOUT)

        if response.status_code == 200:
            result = response.json()
            message_content = result.get("message", {}).get("content", "").strip()
            if not message_content:
                return jsonify({
                    "success": False,
                    "error": "The model returned an empty response. Please try again or refine your prompt."
                }), 502

            return jsonify({
                "success": True,
                "type": gen_type,
                "model_used": requested_model,
                "language": language,
                "tone": tone,
                "generated_text": message_content,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

        elif response.status_code == 404:
            return jsonify({
                "success": False,
                "error": f"Model '{requested_model}' is not installed in Ollama. Run: ollama pull {requested_model}",
                "model_missing": True
            }), 404

        else:
            logger.error(f"Ollama returned HTTP {response.status_code}: {response.text[:200]}")
            return jsonify({
                "success": False,
                "error": f"Ollama error (HTTP {response.status_code}). Please verify the local model status."
            }), 502

    except requests.exceptions.ConnectionError:
        logger.warning(f"Connection to Ollama at {OLLAMA_HOST} refused.")
        return jsonify({
            "success": False,
            "error": "Could not connect to Ollama. Make sure Ollama is running locally on your system.",
            "ollama_offline": True
        }), 503

    except requests.exceptions.Timeout:
        logger.warning(f"Ollama generation timed out after {OLLAMA_TIMEOUT}s.")
        return jsonify({
            "success": False,
            "error": f"Generation timed out after {OLLAMA_TIMEOUT} seconds. Your CPU may be busy, or the model is still loading. Please retry.",
            "timeout": True
        }), 504

    except Exception as exc:
        logger.error(f"Unexpected error during generation: {exc}")
        return jsonify({
            "success": False,
            "error": "An unexpected error occurred while generating content. Please try again."
        }), 500


if __name__ == "__main__":
    print(f"Starting MarketMint on http://127.0.0.1:{FLASK_PORT}")
    print(f"Ollama Endpoint: {OLLAMA_HOST} | Default Model: {DEFAULT_MODEL}")
    app.run(host="127.0.0.1", port=FLASK_PORT, debug=FLASK_DEBUG)
