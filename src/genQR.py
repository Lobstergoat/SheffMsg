import qrcode

url = "https://sheffmsg.fun"

qr = qrcode.QRCode(
    version=2,  # size of the QR code (1–40); 1 is smallest
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=10,  # pixel size of each square
    border=2,     # border width (quiet zone)
)
qr.add_data(url)
qr.make(fit=True)

img = qr.make_image(fill_color="black", back_color="white")

img.save("my_permanent_qr.png")
print("Saved as my_permanent_qr.png")
