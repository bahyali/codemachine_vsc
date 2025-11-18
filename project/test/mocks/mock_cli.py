import sys
import time

def main():
    """
    A mock CLI tool that simulates a long-running process.
    It prints arguments, shows progress, and then exits.
    Can be made to fail by passing the '--fail' argument.
    """
    print("MockCli: Process started.")
    args = sys.argv[1:]
    print(f"MockCli: Received arguments: {args}")
    sys.stdout.flush()

    if '--fail' in args:
        print("MockCli: Simulating failure.")
        sys.stderr.write("This is an error message.\n")
        sys.stdout.flush()
        sys.stderr.flush()
        sys.exit(1)

    num_steps = 3
    for i in range(1, num_steps + 1):
        print(f"MockCli: Processing step {i} of {num_steps}...")
        sys.stdout.flush()
        time.sleep(0.1)  # Simulate work for 0.1 seconds for faster tests

    print("MockCli: Process completed successfully.")
    sys.stdout.flush()
    sys.exit(0)

if __name__ == "__main__":
    main()