//! Running a child process with a time limit.
//!
//! `Command::output()` waits forever. For the processes this app starts on a
//! button -- a headless Neovim that loads the user's whole configuration, a
//! `git clone`, the engine -- "forever" is a real outcome: a configuration that
//! stops to ask something, a credential prompt nobody can see, a hung binary.
//! The button then never comes back and a pool thread is lost with it.

use std::io::Read;
use std::time::{Duration, Instant};

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
) -> Result<std::process::Output, String> {
    use std::process::Stdio;
    use std::sync::mpsc;

    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;

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
    let status = loop {
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(status) => break Some(status),
            None if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
            None => std::thread::sleep(Duration::from_millis(25)),
        }
    };

    let grace = Duration::from_millis(500);
    let stdout = out_rx.recv_timeout(grace).unwrap_or_default();
    let stderr = err_rx.recv_timeout(grace).unwrap_or_default();
    match status {
        Some(status) => Ok(std::process::Output {
            status,
            stdout,
            stderr,
        }),
        None => Err(format!("no answer within {} s", limit.as_secs())),
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
        let err = run_with_timeout(&mut shell(line), Duration::from_millis(300)).unwrap_err();
        assert!(err.contains("no answer"), "{err}");
        assert!(
            started.elapsed() < Duration::from_secs(10),
            "must not wait for the child"
        );
    }
}
