# Direct Printing Guide

This guide explains how to set up and use direct printing in the POS Ticket Printer application.

## Overview

Direct printing sends ESC/POS commands directly to the printer device, bypassing the operating system's print spooler. This is significantly faster than the traditional shared printer method.

**Supported connection types:**
- **Network (TCP/IP)** - Best for network printers (recommended)
- **USB** - For USB-connected printers
- **Serial (COM)** - For serial port printers

## Quick Start

1. Navigate to **Setup → Application → Printer Configuration**
2. Under "Método de Impressão", select **"Conexão Direta (Recomendado - Mais rápido)"**
3. Choose your connection type and configure:
   - **Network:** Enter printer IP and port (default: 9100)
   - **USB/Serial:** Enter device path
4. Click **"Testar Conexão"** to verify connectivity
5. Save and test print

## Connection Types

### 1. Network Printing (Recommended)

**Requirements:**
- Printer must have network connectivity
- Know the printer's IP address
- Printer must support raw TCP/IP printing (port 9100)

**Configuration:**
```
Type: Network (TCP/IP)
IP Address: 192.168.1.100  (your printer's IP)
Port: 9100  (standard raw printing port)
```

**How to find printer IP:**
- Print a network configuration page from the printer menu
- Check your router's DHCP client list
- Use printer manufacturer's utility software

**Advantages:**
- Fastest method
- Works from any computer on the network
- No drivers needed
- Most reliable

### 2. USB Printing

**Requirements:**
- Printer connected via USB
- Appropriate permissions (Linux/macOS)

**Configuration:**

**Windows:**
```
Type: USB
Device Path: (will be detected automatically when clicking "Listar")
```

**Linux:**
```
Type: USB
Device Path: /dev/usb/lp0  (or /dev/ttyUSB0)
```

**macOS:**
```
Type: USB
Device Path: /dev/cu.usbserial  (or /dev/tty.usbserial)
```

**Linux Permissions Setup:**

USB devices typically require special permissions. Run these commands:

```bash
# Find your USB device
ls -l /dev/usb/lp*
ls -l /dev/ttyUSB*

# Grant write permission (temporary - lost on reboot)
sudo chmod 666 /dev/usb/lp0

# Permanent solution: Add user to lp group
sudo usermod -a -G lp $USER

# Or create a udev rule (create file: /etc/udev/rules.d/99-printer.rules)
SUBSYSTEM=="usb", ATTRS{idVendor}=="XXXX", ATTRS{idProduct}=="YYYY", MODE="0666"

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

To find your printer's vendor/product ID:
```bash
lsusb
# Output example: Bus 001 Device 005: ID 04b8:0e20 Seiko Epson Corp.
# Vendor ID: 04b8, Product ID: 0e20
```

### 3. Serial (COM) Printing

**Requirements:**
- Printer connected via serial port or USB-to-Serial adapter

**Configuration:**

**Windows:**
```
Type: Serial (COM)
Device Path: COM1  (or COM2, COM3, etc.)
```

**Linux/macOS:**
```
Type: Serial
Device Path: /dev/ttyS0  (or /dev/ttyUSB0)
```

**Linux Permissions:**
```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER

# Or grant permission directly
sudo chmod 666 /dev/ttyS0
```

## Troubleshooting

### Network Printing

**Problem:** "Cannot connect to 192.168.1.100:9100"

**Solutions:**
1. Verify printer IP address:
   ```bash
   ping 192.168.1.100
   ```
2. Check if port 9100 is open:
   ```bash
   telnet 192.168.1.100 9100
   # Or use: nc -zv 192.168.1.100 9100
   ```
3. Ensure printer has raw printing enabled (check printer web interface)
4. Check firewall rules
5. Try alternative ports (9100, 9101, 9102)

### USB/Serial Printing

**Problem:** "USB device not found: /dev/usb/lp0"

**Solutions:**
1. Verify device exists:
   ```bash
   ls -l /dev/usb/lp*
   ls -l /dev/ttyUSB*
   ```
2. Check USB connection:
   ```bash
   lsusb
   dmesg | grep -i usb
   ```
3. Install required drivers (if needed)
4. Try different USB ports

**Problem:** "USB device not writable"

**Solutions:**
1. Check permissions:
   ```bash
   ls -l /dev/usb/lp0
   ```
2. Grant write permission (see Linux Permissions Setup above)
3. Ensure user is in correct group (lp, dialout)

### Windows COM Port Issues

**Problem:** "Cannot write to COM1"

**Solutions:**
1. Verify COM port in Device Manager
2. Ensure no other application is using the port
3. Check COM port settings (baud rate, data bits, etc.)
4. Run application as Administrator

## Performance Comparison

| Method | Speed | Reliability | Setup Complexity |
|--------|-------|-------------|------------------|
| Network (Direct) | ⚡⚡⚡ Fastest | ⭐⭐⭐ Excellent | ✅ Easy |
| USB (Direct) | ⚡⚡ Fast | ⭐⭐ Good | ⚠️ Moderate (permissions) |
| Serial (Direct) | ⚡⚡ Fast | ⭐⭐ Good | ⚠️ Moderate |
| Shared Printer (Fallback) | ⚡ Slow | ⭐⭐⭐ Good | ✅ Easy |

## Testing Direct Printing

### Test Network Connection
```bash
# From terminal/command prompt
telnet 192.168.1.100 9100
# Type some text and press Enter
# If printer prints, connection works!
```

### Test USB Device
```bash
# Linux/macOS - send test data
echo "Test" > /dev/usb/lp0

# Windows PowerShell
"Test" | Out-File -FilePath COM1 -Encoding ASCII
```

## Best Practices

1. **Network Printing:**
   - Assign static IP to printer via DHCP reservation
   - Use wired connection for reliability
   - Keep printer firmware updated

2. **USB Printing:**
   - Set up permanent permissions (udev rules on Linux)
   - Use quality USB cables
   - Avoid USB hubs if possible

3. **General:**
   - Always test connection before production use
   - Keep "Shared Printer" as fallback option
   - Document your printer's IP/device path

## Fallback to Shared Printing

If direct printing fails or is unavailable, the system automatically falls back to the shared printer method. You can manually switch back by:

1. Go to **Setup → Application → Printer Configuration**
2. Select **"Impressora Partilhada (Fallback - Mais lento)"**
3. Ensure printer is selected in the dropdown

## Technical Details

Direct printing uses:
- **Network:** Raw TCP sockets (Node.js `net` module) to port 9100
- **USB/Serial:** Direct file descriptor writes (Node.js `fs` module)
- **Windows COM:** PowerShell byte stream writes

All methods send raw ESC/POS command buffers directly to the printer hardware.

## Support

For additional help:
- Check printer manufacturer's documentation
- Verify ESC/POS compatibility
- Review application logs for detailed error messages
- Test with simple ESC/POS commands first

## Dependencies

**No additional dependencies required!** Direct printing uses only built-in Node.js modules:
- `net` (network sockets)
- `fs` (file system)
- `child_process` (Windows COM ports)

All standard in Node.js runtime.
