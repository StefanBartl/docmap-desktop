//! Turning "this should be better" into a filed report.
//!
//! **Nothing is posted from here.** The app builds a prefilled GitHub form
//! and opens it in the reader's browser; they read what it says and press
//! Submit themselves, signed in as themselves. Two reasons, and the second
//! is the one that decided it:
//!
//! 1. This app holds no credentials — the same rule that makes cloning go
//!    through whatever `git clone` already needs on the machine, and repo
//!    listing through `gh`. A feedback box that posted directly would need a
//!    token of its own, and then a place to keep it.
//! 2. Sending something to a public tracker is publishing. The person
//!    writing it has to see the final text and press the button; a dialog
//!    with a Send button that fires straight into a public thread is a
//!    different thing than it looks like, especially with the environment
//!    block this attaches.
//!
//! **Issues, not Discussions**, because Discussions are switched off on both
//! repositories as of 2026-08-19 and a link into a disabled feature is a
//! dead end. The mapping lives in one table below, so turning Discussions on
//! later moves a category by editing one line.

/// What kind of feedback this is, and where that kind belongs.
///
/// An allowlist keyed by a short name the frontend sends. The webview never
/// supplies a URL — only which of these it means — so nothing the page can
/// say turns into a browser opening an arbitrary address.
struct Topic {
    /// The value the frontend sends. Never shown; the visible label is the
    /// catalog's, like every other string in this window.
    id: &'static str,
    /// Path under the repository, with its query already decided.
    path: &'static str,
}

const TOPICS: &[Topic] = &[
    Topic {
        id: "feature",
        path: "issues/new?labels=enhancement",
    },
    Topic {
        id: "bug",
        path: "issues/new?labels=bug",
    },
    Topic {
        id: "question",
        path: "issues/new?labels=question",
    },
    Topic {
        id: "docs",
        path: "issues/new?labels=documentation",
    },
    Topic {
        id: "other",
        path: "issues/new",
    },
];

/// Percent-encode for a query parameter.
///
/// Written out rather than pulled in: this needs one direction of one
/// encoding, and the set of characters that may stay is short enough to
/// state. Space becomes `%20` rather than `+` — both are read correctly by
/// GitHub, and `%20` is the one that is also correct outside a form body.
fn encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for byte in s.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

/// A browser will refuse a URL past some length, and GitHub's own limit
/// arrives sooner. Truncated with a visible marker rather than silently, so
/// a long report arrives obviously cut instead of mysteriously ending
/// mid-sentence — and the reader is standing in front of the form when it
/// happens and can paste the rest.
const MAX_BODY: usize = 4000;

/// Build the URL for a prefilled report. Public for the sake of its tests:
/// what this produces is the whole feature, and it is a pure function.
pub fn url(repo: &str, topic: &str, title: &str, body: &str) -> Result<String, String> {
    let entry = TOPICS
        .iter()
        .find(|t| t.id == topic)
        .ok_or_else(|| format!("no such feedback topic: {topic}"))?;

    let mut body = body.to_string();
    if body.len() > MAX_BODY {
        // On a character boundary: `String::truncate` panics in the middle of
        // a multi-byte character, and a German report is full of them.
        let mut cut = MAX_BODY;
        while cut > 0 && !body.is_char_boundary(cut) {
            cut -= 1;
        }
        body.truncate(cut);
        body.push_str("\n\n…(truncated — paste the rest here)");
    }

    let separator = if entry.path.contains('?') { '&' } else { '?' };
    Ok(format!(
        "https://github.com/StefanBartl/{repo}/{}{separator}title={}&body={}",
        entry.path,
        encode(title),
        encode(&body)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_feature_request_goes_to_issues_labelled_enhancement() {
        let u = url("docmap-desktop", "feature", "Dark mode", "Please").unwrap();
        assert!(u.starts_with("https://github.com/StefanBartl/docmap-desktop/issues/new?"));
        assert!(u.contains("labels=enhancement"));
        assert!(u.contains("title=Dark%20mode"));
        assert!(u.contains("body=Please"));
    }

    #[test]
    fn the_query_separator_is_right_with_and_without_a_label() {
        // `other` carries no label and so no `?` of its own. Getting this
        // wrong produces a URL with two `?` in it, which GitHub reads as a
        // title containing a question mark and an empty body.
        let labelled = url("docmap-desktop", "bug", "t", "b").unwrap();
        let bare = url("docmap-desktop", "other", "t", "b").unwrap();
        assert_eq!(labelled.matches('?').count(), 1, "{labelled}");
        assert_eq!(bare.matches('?').count(), 1, "{bare}");
    }

    #[test]
    fn an_unknown_topic_is_refused_rather_than_guessed() {
        assert!(url("docmap-desktop", "../../evil", "t", "b").is_err());
    }

    #[test]
    fn everything_that_could_break_a_url_is_encoded() {
        let u = url("docmap-desktop", "bug", "a&b=c#d", "line\nbreak & ümlaut").unwrap();
        // The user's `&`, `=` and `#` must not become URL syntax — that is
        // how a title ends up truncated at the first ampersand.
        assert!(u.contains("title=a%26b%3Dc%23d"), "{u}");
        assert!(u.contains("%0A"), "a newline must survive as %0A: {u}");
        assert!(u.contains("%C3%BC"), "ü is two bytes and both are encoded: {u}");
        assert_eq!(u.matches('#').count(), 0, "a bare # would cut the URL: {u}");
    }

    #[test]
    fn a_long_body_is_cut_visibly_and_on_a_character_boundary() {
        // Multi-byte characters right at the limit: truncating mid-character
        // panics, and a German report is full of them.
        let long = "ü".repeat(MAX_BODY);
        let u = url("docmap-desktop", "bug", "t", &long).unwrap();
        assert!(u.contains("truncated"), "the cut has to be visible");
    }
}
