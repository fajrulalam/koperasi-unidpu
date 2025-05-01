# Thermal Printer Server for UniMart

This is a local server that enables direct printing to USB thermal printers from the UniMart web application.

## Installation

1. Make sure Node.js is installed on the computer that has the thermal printer connected.
2. Open a terminal/command prompt in this directory.
3. Run the following command to install dependencies:

```
npm install
```

## Running the Print Server

To start the print server, run:

```
npm start
```

The server will start on port 9001 by default.

## Configuration

The server will automatically detect connected USB thermal printers. No additional configuration is needed in most cases.

If you want to run the server on a different port, you can set the PORT environment variable before starting:

```
PORT=8080 npm start
```

## Usage

Once the server is running, the web application will automatically try to connect to it for printing receipts. If the server is not running or not accessible, the application will fall back to browser-based printing.

## Troubleshooting

If you encounter issues with printer detection:

1. Make sure the thermal printer is connected via USB and powered on
2. Check if the printer drivers are installed
3. Try disconnecting and reconnecting the printer
4. Restart the print server
5. Check the server logs for any error messages

## Requirements

- Node.js 14 or higher
- USB thermal printer compatible with ESC/POS commands
- Windows, macOS, or Linux operating system