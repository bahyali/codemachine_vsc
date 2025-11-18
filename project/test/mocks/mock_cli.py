import sys
import time

def main():
    """
    A mock CLI tool that simulates a long-running process.
    It prints arguments, shows progress, and then exits.
    """
    print("MockCli: Process started.")
    print(f"MockCli: Received arguments: {sys.argv[1:]}")
    sys.stdout.flush()

    num_steps = 3
    for i in range(1, num_steps + 1):
        print(f"MockCli: Processing step {i} of {num_steps}...")
        sys.stdout.flush()
        time.sleep(0.5)  # Simulate work for 0.5 seconds

    print("MockCli: Process completed successfully.")
    sys.stdout.flush()
    sys.exit(0)

if __name__ == "__main__":
    main()