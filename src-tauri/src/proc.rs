//! Running a child process with a time limit.
//!
//! `Command::output()` waits forever. For the processes this app starts on a
//! button -- a headless Neovim that loads the user's whole configuration, a
//! `git clone`, the engine -- "forever" is a real outcome: a configuration that
//! stops to ask something, a credential prompt nobody can see, a hung binary.
//! The button then never comes back and a pool thread is lost with it.

use std::io::Read;
use std::time::{Duration, Instant};

use crate::apperr::AppError;

/// Why [`run_with_timeout`] has no output to hand back. Not an [`AppError`]
/// itself: which sentence fits depends on the program (a Neovim that does not
/// answer is most likely waiting for input), so the caller picks it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProcError {
    /// It could not be started or waited for; the OS error, verbatim.
    Failed(String),
    /// It was killed after this many seconds without finishing.
    Timeout(u64),
}

impl ProcError {
    /// `err.proc.run` or `err.proc.timeout`, naming `program`.
    pub fn into_app(self, program: &str) -> AppError {
        match self {
            ProcError::Failed(e) => AppError::new("err.proc.run")
                .with("program", program)
                .detail(e),
            ProcError::Timeout(secs) => AppError::new("err.proc.timeout")
                .with("program", program)
                .with("secs", secs),
        }
    }

    /// The same for a headless Neovim, whose silence asks a question of its
    /// own: does the configuration stop to wait for input?
    pub fn into_nvim(self, program: &str) -> AppError {
        match self {
            ProcError::Timeout(secs) => AppError::new("err.nvim.timeout")
                .with("program", program)
                .with("secs", secs),
            failed => failed.into_app(program),
        }
    }
}

/// Run `cmd` to completion and collect its output, or kill it after `limit`.
///
/// Only the child this function started is killed, by its handle. The output
/// is read on separate threads so a full pipe cannot stall the child while this
/// one waits, and after a kill the readers get a short grace period rather
/// than being joined: a grandchild that inherited the pipe would otherwise keep
/// them (and this call) alive.
pub fn run_with_timeout(
    cmd: &mut std::process::Command,
    limit: Duration,
) -> Result<std::process::Output, ProcError> {
    use std::process::Stdio;
    use std::sync::mpsc;

    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| ProcError::Failed(e.to_string()))?;

    fn drain<R: Read + Send + 'static>(pipe: Option<R>) -> mpsc::Receiver<Vec<u8>> {
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut buf = Vec::new();
            if let Some(mut p) = pipe {
                let _ = p.read_to_end(&mut buf);
            }
            let _ = tx.send(buf);
        });
        rx
    }
    let out_rx = drain(child.stdout.take());
    let err_rx = drain(child.stderr.take());

    let deadline = Instant::now() + limit;
    // `None` covers both ways out of the loop without a status: the deadline
    // passed, or `try_wait` itself errored. Either way the child is killed
    // before this function returns -- a bare `?` on the error would have
    // left it running, unread and un-reaped, for as long as it lives.
    let mut wait_err: Option<String> = None;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(25)),
            Err(e) => {
                wait_err = Some(e.to_string());
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
        }
    };

    let grace = Duration::from_millis(500);
    let stdout = out_rx.recv_timeout(grace).unwrap_or_default();
    let stderr = err_rx.recv_timeout(grace).unwrap_or_default();
    match (status, wait_err) {
        (Some(status), _) => Ok(std::process::Output {
            status,
            stdout,
            stderr,
        }),
        (None, Some(e)) => Err(ProcError::Failed(e)),
        (None, None) => Err(ProcError::Timeout(limit.as_secs())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    fn shell(line: &str) -> std::process::Command {
        let mut c = std::process::Command::new("cmd");
        c.args(["/c", line]);
        c
    }
    #[cfg(not(windows))]
    fn shell(line: &str) -> std::process::Command {
        let mut c = std::process::Command::new("sh");
        c.args(["-c", line]);
        c
    }

    #[test]
    fn a_finished_process_returns_its_output() {
        let out = run_with_timeout(&mut shell("echo hello"), Duration::from_secs(20)).unwrap();
        assert!(out.status.success());
        assert!(String::from_utf8_lossy(&out.stdout).contains("hello"));
    }

    #[test]
    fn a_process_that_does_not_finish_is_killed_and_reported() {
        #[cfg(windows)]
        let line = "ping -n 30 127.0.0.1 >nul";
        #[cfg(not(windows))]
        let line = "sleep 30";
        let started = Instant::now();
        let err = run_with_timeout(&mut shell(line), Duration::from_millis(1300)).unwrap_err();
        assert_eq!(err, ProcError::Timeout(1));
        assert!(
            started.elapsed() < Duration::from_secs(10),
            "must not wait for the child"
        );
    }

    #[test]
    fn a_program_that_cannot_start_is_a_failure_with_the_os_error() {
        let mut cmd = std::process::Command::new("docmap-desktop-no-such-program-x");
        let err = run_with_timeout(&mut cmd, Duration::from_secs(5)).unwrap_err();
        let ProcError::Failed(text) = &err else {
            panic!("{err:?}")
        };
        assert!(!text.is_empty());
        let app = err.into_app("x");
        assert_eq!(app.key(), "err.proc.run");
        assert_eq!(app.param("program"), Some("x"));
    }

    #[test]
    fn a_silent_neovim_is_asked_whether_it_waits_for_input() {
        let e = ProcError::Timeout(60).into_nvim("nvim");
        assert_eq!(e.key(), "err.nvim.timeout");
        assert_eq!(e.param("secs"), Some("60"));
        let e = ProcError::Timeout(60).into_app("git");
        assert_eq!(e.key(), "err.proc.timeout");
        let e = ProcError::Failed("nope".into()).into_nvim("nvim");
        assert_eq!(e.key(), "err.proc.run");
        assert_eq!(e.detail_text(), Some("nope"));
    }
}
