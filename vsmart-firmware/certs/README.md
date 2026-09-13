# Device certificates

Where the files downloaded from AWS IoT Core live. The firmware does **not**
read them at build time — it embeds the PEM strings via `include/secrets.h`
(see `include/secrets.example.h`).

Current set — IoT thing `NCKH-2025-2026`, account `022499043310`,
region `ap-southeast-1`, certificate ID `1f8caa5c…902b7351` (ACTIVE):

| File | Used as |
|---|---|
| `AmazonRootCA1.pem` | `AWS_CERT_CA` |
| `<id>-certificate.pem.crt` | `AWS_CERT_CRT` |
| `<id>-private.pem.key` | `AWS_CERT_PRIVATE` |
| `<id>-public.pem.key` | unused by the firmware |

To confirm a key and certificate belong together:

```bash
openssl x509 -noout -modulus -in <id>-certificate.pem.crt | openssl md5
openssl rsa  -noout -modulus -in <id>-private.pem.key     | openssl md5
```

Both digests must match.

This directory used to sit at `lib/secrets/`, which was the wrong place:
PlatformIO scans `lib/` for libraries, so everything in there was dragged into
dependency resolution.

Only `AmazonRootCA*.pem` is tracked by git; the device certificate and private
key are excluded in `.gitignore`. AWS lets you download a private key **only at
creation time** — if this one is lost, the certificate has to be replaced.
