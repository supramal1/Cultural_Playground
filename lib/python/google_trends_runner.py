#!/usr/bin/env python3
import json
import sys
from datetime import datetime
import warnings


# Local runtime often links Python ssl to LibreSSL (macOS default), which triggers
# urllib3 v2 NotOpenSSLWarning noise without breaking functionality.
warnings.filterwarnings(
    "ignore",
    message="urllib3 v2 only supports OpenSSL 1.1.1+.*",
)


def read_input():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    return json.loads(raw)


def normalize_date(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d")
    except Exception:
        return None


def main():
    payload = read_input()
    keywords = payload.get("keywords") or []
    geo = payload.get("geo") or "GB"
    from_date = normalize_date(payload.get("from") or "")
    to_date = normalize_date(payload.get("to") or "")

    result = {
        "topRelatedQueries": [],
        "topRelatedTopics": [],
        "interestOverTime": [],
        "warnings": [],
    }

    if not keywords:
        result["warnings"].append("No keywords provided to Google Trends runner.")
        print(json.dumps(result))
        return

    try:
        from pytrends.request import TrendReq  # type: ignore
    except Exception:
        result["warnings"].append(
            "pytrends is not installed. Install it to enable Google Trends signals."
        )
        print(json.dumps(result))
        return

    try:
        pytrends = TrendReq(hl="en-GB", tz=0)
        if from_date and to_date:
            timeframe = f"{from_date} {to_date}"
        else:
            timeframe = "today 3-m"

        kw_list = [str(k).strip() for k in keywords if str(k).strip()][:5]
        pytrends.build_payload(kw_list=kw_list, cat=0, timeframe=timeframe, geo=geo)

        iot = pytrends.interest_over_time()
        if iot is not None and not iot.empty:
            key = kw_list[0]
            for idx, row in iot.iterrows():
                if key in row:
                    value = row[key]
                    try:
                        numeric = int(value)
                    except Exception:
                        continue
                    result["interestOverTime"].append(
                        {
                            "date": idx.strftime("%Y-%m-%d"),
                            "value": max(0, min(100, numeric)),
                        }
                    )

        related = pytrends.related_queries()
        topic_related = pytrends.related_topics()

        for keyword in kw_list:
            rq = related.get(keyword) if isinstance(related, dict) else None
            if isinstance(rq, dict):
                top_df = rq.get("top")
                rising_df = rq.get("rising")
                if top_df is not None:
                    for _, row in top_df.head(8).iterrows():
                        query = str(row.get("query", "")).strip()
                        if not query:
                            continue
                        value = row.get("value")
                        result["topRelatedQueries"].append(
                            {
                                "query": query,
                                "type": "top",
                                "value": int(value) if value is not None else None,
                            }
                        )
                if rising_df is not None:
                    for _, row in rising_df.head(8).iterrows():
                        query = str(row.get("query", "")).strip()
                        if not query:
                            continue
                        value = row.get("value")
                        try:
                            numeric = int(value)
                        except Exception:
                            numeric = None
                        result["topRelatedQueries"].append(
                            {
                                "query": query,
                                "type": "rising",
                                "value": numeric,
                            }
                        )

            rt = topic_related.get(keyword) if isinstance(topic_related, dict) else None
            if isinstance(rt, dict):
                top_df = rt.get("top")
                rising_df = rt.get("rising")
                if top_df is not None:
                    for _, row in top_df.head(8).iterrows():
                        topic = str(row.get("topic_title", "")).strip()
                        if not topic:
                            continue
                        value = row.get("value")
                        try:
                            numeric = int(value)
                        except Exception:
                            numeric = None
                        result["topRelatedTopics"].append(
                            {
                                "topic": topic,
                                "type": "top",
                                "value": numeric,
                            }
                        )
                if rising_df is not None:
                    for _, row in rising_df.head(8).iterrows():
                        topic = str(row.get("topic_title", "")).strip()
                        if not topic:
                            continue
                        value = row.get("value")
                        try:
                            numeric = int(value)
                        except Exception:
                            numeric = None
                        result["topRelatedTopics"].append(
                            {
                                "topic": topic,
                                "type": "rising",
                                "value": numeric,
                            }
                        )

        # Deduplicate while preserving order
        seen_queries = set()
        deduped_queries = []
        for item in result["topRelatedQueries"]:
            key = (item.get("query", "").lower(), item.get("type"))
            if key in seen_queries:
                continue
            seen_queries.add(key)
            deduped_queries.append(item)
        result["topRelatedQueries"] = deduped_queries[:20]

        seen_topics = set()
        deduped_topics = []
        for item in result["topRelatedTopics"]:
            key = (item.get("topic", "").lower(), item.get("type"))
            if key in seen_topics:
                continue
            seen_topics.add(key)
            deduped_topics.append(item)
        result["topRelatedTopics"] = deduped_topics[:20]

    except Exception as exc:
        result["warnings"].append(f"Google Trends runner failed: {str(exc)}")

    print(json.dumps(result))


if __name__ == "__main__":
    main()
