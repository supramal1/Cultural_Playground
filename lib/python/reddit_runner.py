#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
import urllib.parse
from collections import Counter

STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "your",
    "about",
    "into",
    "have",
    "what",
    "when",
    "where",
    "will",
    "just",
    "more",
    "after",
    "over",
    "under",
    "they",
    "them",
    "their",
    "been",
    "also",
    "could",
    "would",
    "should",
}

USER_AGENT = "CultureBot/1.0 (by /u/culturebot_app)"


def read_input():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def tokenize(text):
    parts = re.split(r"[^a-z0-9]+", text.lower())
    return [token for token in parts if len(token) >= 4 and token not in STOPWORDS]


def curl_json(url, headers=None, post_data=None, basic_auth=None):
    """Fetch JSON using curl subprocess (avoids Python urllib 403 blocks)."""
    cmd = ["curl", "-s", "-f", "--max-time", "25"]
    if basic_auth:
        cmd += ["-u", basic_auth]
    if headers:
        for key, value in headers.items():
            cmd += ["-H", f"{key}: {value}"]
    if post_data:
        cmd += ["-X", "POST", "-d", post_data]
    cmd.append(url)

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"curl failed (exit {result.returncode}): {result.stderr.strip()}")
    return json.loads(result.stdout)


def get_oauth_token(client_id, client_secret):
    """Get an application-only OAuth2 token from Reddit."""
    payload = curl_json(
        "https://www.reddit.com/api/v1/access_token",
        headers={"User-Agent": USER_AGENT},
        post_data="grant_type=client_credentials",
        basic_auth=f"{client_id}:{client_secret}",
    )
    token = payload.get("access_token")
    if not token:
        raise RuntimeError(f"No access_token in response: {json.dumps(payload)}")
    return token


def build_search_url(keywords, use_oauth=False):
    query = " OR ".join(keywords[:4])
    params = urllib.parse.urlencode(
        {
            "q": query,
            "sort": "top",
            "t": "month",
            "limit": 20,
            "restrict_sr": "false",
        }
    )
    host = "oauth.reddit.com" if use_oauth else "www.reddit.com"
    return f"https://{host}/search.json?{params}"


def main():
    payload = read_input()
    keywords = [str(k).strip() for k in (payload.get("keywords") or []) if str(k).strip()]

    result = {
        "subredditCandidates": [],
        "topPosts": [],
        "commonThemes": [],
        "warnings": [],
    }

    if not keywords:
        result["warnings"].append("No keywords provided to Reddit runner.")
        print(json.dumps(result))
        return

    client_id = os.environ.get("REDDIT_CLIENT_ID", "").strip()
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET", "").strip()
    token = None
    use_oauth = False

    if client_id and client_secret:
        try:
            token = get_oauth_token(client_id, client_secret)
            use_oauth = True
        except Exception as exc:
            result["warnings"].append(f"Reddit OAuth failed: {str(exc)}")
    else:
        result["warnings"].append(
            "No REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET set. "
            "Create a Reddit app at https://www.reddit.com/prefs/apps/ "
            "(script type) and add credentials to .env.local."
        )

    try:
        headers = {"User-Agent": USER_AGENT}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        data = curl_json(build_search_url(keywords, use_oauth=use_oauth), headers=headers)
    except Exception as exc:
        result["warnings"].append(f"Reddit search failed: {str(exc)}")
        print(json.dumps(result))
        return

    children = (
        data.get("data", {}).get("children", [])
        if isinstance(data, dict)
        else []
    )

    subreddit_counter = Counter()
    term_counter = Counter()

    for child in children[:20]:
        post = child.get("data", {}) if isinstance(child, dict) else {}
        title = str(post.get("title") or "").strip()
        subreddit = str(post.get("subreddit") or "").strip()
        permalink = str(post.get("permalink") or "").strip()
        score = post.get("score")
        comments = post.get("num_comments")
        created_utc = post.get("created_utc")

        if not title or not subreddit or not permalink:
            continue

        if not permalink.startswith("http"):
            permalink = f"https://www.reddit.com{permalink}"

        subreddit_counter[subreddit] += 1

        for token_str in tokenize(title):
            term_counter[token_str] += 1

        try:
            numeric_score = int(score) if score is not None else None
        except Exception:
            numeric_score = None

        try:
            numeric_comments = int(comments) if comments is not None else None
        except Exception:
            numeric_comments = None

        try:
            numeric_created = int(float(created_utc)) if created_utc is not None else None
        except Exception:
            numeric_created = None

        result["topPosts"].append(
            {
                "title": title,
                "subreddit": subreddit,
                "url": permalink,
                "score": numeric_score,
                "comments": numeric_comments,
                "createdUtc": numeric_created,
            }
        )

    for subreddit, count in subreddit_counter.most_common(3):
        result["subredditCandidates"].append(
            {
                "name": subreddit,
                "reason": f"Appeared in {count} top search posts for supplied keywords.",
            }
        )

    result["commonThemes"] = [
        t for t, _count in term_counter.most_common(8)
    ]

    result["topPosts"] = result["topPosts"][:10]

    print(json.dumps(result))


if __name__ == "__main__":
    main()
