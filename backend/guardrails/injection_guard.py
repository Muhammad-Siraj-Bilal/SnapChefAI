"""
SnapChef AI — Prompt Injection & Jailbreak Guard
Multi-layer detection of adversarial inputs before they reach the LLM.

Layers:
  1. Direct injection pattern matching (regex)
  2. Role/identity hijacking phrases
  3. Delimiter injection (system prompt leakage attempts)
  4. Instruction override attempts
  5. Encoded/obfuscated attack detection
"""

import re
import logging
from dataclasses import dataclass
from typing import Tuple

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Layer 1: Classic Prompt Injection Patterns
# ─────────────────────────────────────────────
_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(p, re.IGNORECASE) for p in [
        # Ignore/disregard previous context
        r"ignore\s+(all\s+)?(your\s+)?(previous|prior|above|earlier)?\s*(instructions?|prompts?|context|rules?|guidelines?|constraints?)",
        r"disregard\s+(all\s+)?(your\s+)?(previous|prior|above|earlier)?\s*(instructions?|prompts?|context|rules?)",
        r"forget\s+(all\s+)?(your\s+)?(previous|prior|above|earlier|everything)?\s*(instructions?|prompts?|context|rules?|you.?ve been told)",
        r"override\s+(your\s+)?(instructions?|system\s+prompt|rules?|programming|training|guidelines?)",

        # New instruction injection
        r"new\s+instruction[s]?\s*:",
        r"updated?\s+instruction[s]?\s*:",
        r"from\s+now\s+on[,\s]+you\s+(are|will|must|should)",

        # System prompt leakage
        r"\[system\]",
        r"<\|system\|>",
        r"###\s*system",
        r"<system>",
        r"\[INST\]",
        r"<<SYS>>",
        r"<\|im_start\|>",
        r"<\|im_end\|>",
        r"<\|user\|>",
        r"<\|assistant\|>",

        # Role injection
        r"you\s+are\s+now\s+(a|an|the)\s+\w+",
        r"act\s+as\s+(if\s+you\s+are|a|an)\s+.{0,40}(without\s+restriction|no\s+filter|unrestricted|uncensored)",
        r"pretend\s+(you\s+)?(are|have\s+no)\s+(restriction|filter|limit|rule|guideline)",
        r"roleplaying\s+as\s+an?\s+\w+\s+with\s+no\s+(restriction|limit|filter)",

        # DAN / jailbreak personas
        r"\bDAN\b",
        r"do\s+anything\s+now",
        r"jailbreak",
        r"dev\s*mode",
        r"developer\s+mode",
        r"god\s+mode",
        r"unrestricted\s+mode",
        r"no-filter\s+mode",
        r"training\s+data",
        r"(pretend|roleplay|act\s+as|simulate)\s+.*?(mode|person|user|chef|assistant)",
        r"you\s+are\s+no\s+longer",
        r"your\s+new\s+rules?",

        # Reveal system prompt
        r"(print|show|reveal|output|repeat|tell me|what is)\s+(your\s+)?(system\s+prompt|instructions?|initial\s+prompt|original\s+prompt|hidden\s+prompt)",
        r"what\s+were\s+you\s+told",
        r"what\s+are\s+your\s+instructions",
        r"(print|show|reveal|output|tell|repeat|display)\s+.*?(hidden|internal|private|system)\s+.*?(memory|logs?|prompt|instructions?|chain|thought|process|rules?)",
        r"(raw|exact|original)\s+.*? (response|output|text|prompt)",

        # Constraint suppression
        r"(ignore|disregard|forget|skip|override|bypass|disable|remove|delete|reset)\s+.*?(safety|allergy|warnings?|rules?|constraints?|filters?|guidelines?|allergies|guardrails?|restrictions?|blockade|limiters?)",
        r"(never|do\s+not|don.?t|stop|quit|avoid)\s+.*?(show|mention|give|output|display|tell|use|apply)\s+.*?(allergy|safety|warning|caution|allergies|disclaimer)",
        r"(always|forever)\s+.*? (halal|safe|good|healthy)", # Forced positive bias

        # Indirect manipulation
        r"hypothetically\s+speaking.{0,30}(how|give|tell|explain)",
        r"(for\s+)?(educational|university|research|study|demo|test|simulation|academic)\s+.*?(purposes?|only|reasons?|settings?)",
        r"in\s+a\s+story.{0,30}(how|explain|show).{0,30}(poison|harm|hurt|kill|injure)",

        # Token manipulation
        r"\\n\\n\\n\s*(system|assistant|user)\s*:",
        r"\{\{.*?\}\}",   # Template injection
        r"\$\{.*?\}",     # Variable injection
    ]
]

# ─────────────────────────────────────────────
# Layer 2: Cooking-context anomaly patterns
# These are phrases that make no sense in a cooking app context
# and strongly indicate adversarial intent
# ─────────────────────────────────────────────
_ANOMALY_PATTERNS: list[re.Pattern] = [
    re.compile(p, re.IGNORECASE) for p in [
        # Attempting to get non-culinary harmful info
        r"(how\s+to\s+make|recipe\s+for|synthesize|produce|manufacture)\s+(drugs?|meth|cocaine|heroin|explosives?|bomb|poison|toxin|nerve\s+agent)",
        r"(step[\s-]by[\s-]step|instructions?)\s+(for|to)\s+(harm|hurt|kill|poison|attack|injure)",
        r"laxative\s+recipe|emetic|make\s+(someone|a\s+person)\s+(sick|ill|vomit)",
        r"(raw|undercooked)\s+(chicken|pork|meat)\s+(is\s+)?(safe|fine|okay|ok)",
        r"how\s+to\s+poison\s+(someone|a\s+person|food|drink|water)",

        # Extremely off-topic
        r"(social\s+security|credit\s+card|bank\s+account|password|login|hack|phish)",
        r"(attack|exploit|vulnerability|malware|ransomware|zero.?day)",

        # Poisonous/Dangerous ingredients
        r"(poisonous|toxic|lethal|dangerous|deadly|fatal|venomous)\s+(mushrooms?|ingredients?|plants?|food|berries)",
        r"include\s+(toxic|poisonous|lethal|deadly)",
    ]
]

# Maximum safe message length (chars) — guard against token-stuffing
MAX_MESSAGE_LENGTH = 4000


@dataclass
class InjectionResult:
    is_injection: bool
    threat_type: str          # "injection" | "jailbreak" | "harmful_content" | "anomaly" | ""
    matched_pattern: str      # human-readable description of what triggered
    safe_reply: str


def _make_safe_reply(threat_type: str) -> str:
    if threat_type == "jailbreak":
        return (
            "I'm SnapChef AI — a cooking assistant. I can't change my identity, "
            "role, or guidelines. How can I help with your recipe today? 🍳"
        )
    if threat_type == "harmful_content":
        return (
            "I'm only able to help with safe, healthy cooking. "
            "I can't assist with that request."
        )
    return (
        "Your message contains content that looks like an attempt to manipulate "
        "my instructions. I'm here to help with cooking — what would you like to make? 🧑‍🍳"
    )


def check_prompt_injection(text: str) -> InjectionResult:
    """
    Multi-layer prompt injection and jailbreak detection.

    Args:
        text: The raw user input string to analyze.

    Returns:
        InjectionResult with detection details.
    """
    if not text or not text.strip():
        return InjectionResult(False, "", "", "")

    # --- Length guard ---
    if len(text) > MAX_MESSAGE_LENGTH:
        logger.warning(f"Injection guard: message too long ({len(text)} chars). Truncated check.")
        text = text[:MAX_MESSAGE_LENGTH]

    text_stripped = text.strip()

    # --- Layer 1: Injection patterns ---
    for pattern in _INJECTION_PATTERNS:
        match = pattern.search(text_stripped)
        if match:
            matched = match.group(0)[:80]
            threat = "jailbreak" if any(
                kw in matched.lower()
                for kw in ["dan", "jailbreak", "dev mode", "god mode", "act as", "you are now", "pretend"]
            ) else "injection"
            logger.warning(
                f"Prompt injection detected [{threat}]: pattern='{pattern.pattern[:60]}' "
                f"matched='{matched}'"
            )
            return InjectionResult(
                is_injection=True,
                threat_type=threat,
                matched_pattern=matched,
                safe_reply=_make_safe_reply(threat),
            )

    # --- Layer 2: Cooking anomaly / harmful content ---
    for pattern in _ANOMALY_PATTERNS:
        match = pattern.search(text_stripped)
        if match:
            matched = match.group(0)[:80]
            logger.warning(f"Harmful content detected: pattern='{pattern.pattern[:60]}' matched='{matched}'")
            return InjectionResult(
                is_injection=True,
                threat_type="harmful_content",
                matched_pattern=matched,
                safe_reply=_make_safe_reply("harmful_content"),
            )

    # --- Layer 3: Delimiter injection (unusual characters used in prompt attacks) ---
    # Look for multiple consecutive newlines mixed with role-like words
    delimiter_abuse = re.search(
        r"(\n{3,}|\r\n){1,}\s*(system|human|assistant|user)\s*:", text_stripped, re.IGNORECASE
    )
    if delimiter_abuse:
        logger.warning(f"Delimiter injection detected: '{delimiter_abuse.group(0)[:80]}'")
        return InjectionResult(
            is_injection=True,
            threat_type="injection",
            matched_pattern=delimiter_abuse.group(0)[:80],
            safe_reply=_make_safe_reply("injection"),
        )

    return InjectionResult(is_injection=False, threat_type="", matched_pattern="", safe_reply="")


def sanitize_input(text: str) -> str:
    """
    Light sanitization of user input:
    - Strip leading/trailing whitespace
    - Collapse excessive whitespace runs
    - Remove null bytes
    """
    if not text:
        return ""
    text = text.replace("\x00", "")                     # null bytes
    text = re.sub(r"[ \t]{3,}", "  ", text)             # excessive spaces/tabs
    text = re.sub(r"\n{4,}", "\n\n\n", text)            # excessive newlines
    return text.strip()
