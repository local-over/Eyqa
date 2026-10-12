"""Embedded Free Claude Code (FCC) Background Service for Eyqa.
Allows editing and running FCC directly as an internal library in Eyqa.
"""
import sys
import os
from pathlib import Path

# Add src to sys.path so 'fcc' can be imported
current_dir = Path(__file__).resolve().parent
src_dir = current_dir.parent

if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))

# Alias fcc as free_claude_code so all internal package imports resolve
import fcc
sys.modules['free_claude_code'] = fcc

from fcc.cli.commands import ServerSupervisor

def run():
    print(f"[Eyqa FCC Background Library] Running from {current_dir} on port 8082...")
    supervisor = ServerSupervisor(console_logging=True)
    supervisor.run(open_admin_browser=False)

if __name__ == "__main__":
    run()
