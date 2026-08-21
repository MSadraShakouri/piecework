# Piecework APK signing guide

This file explains the fixed debug keystore setup used by the GitHub Actions APK workflow in this repository.

## Why the base64 keystore matters

Android treats an installed app as the same app only when **both** of these stay the same:

1. The Android package/application id, for Piecework:

   ```text
   com.msadrashakouri.piecework
   ```

2. The signing certificate used to sign the APK.

If you build two APKs with the same package id but different signing certificates, Android will refuse to install the newer APK over the existing one. You would see an error like:

```text
App not installed
The package conflicts with an existing package by the same name
```

or:

```text
INSTALL_FAILED_UPDATE_INCOMPATIBLE
```

That is why your `lyric-sync` workflow used a fixed base64 keystore. The base64 value is not really a hash; it is the entire Java/Android keystore file encoded as text so GitHub Actions can recreate the same signing key every time.

The important rule is:

> Generate the keystore once, save it safely, and use that same keystore for every future APK build.

## Debug APK approach, matching the lyrics app style

Your `lyric-sync` workflow built a **debug APK**, but it replaced the normal auto-generated debug key with a custom fixed keystore from GitHub Secrets.

That means every debug APK from GitHub Actions was signed with the same certificate, so Android allowed updates to install over the previous APK.

For Piecework, you can use the same approach.

## One-time keystore generation

You need Java installed locally because the command uses `keytool`.

Generate a keystore once:

```bash
keytool -genkeypair -v \
  -keystore piecework-debug.jks \
  -storepass android \
  -alias piecework \
  -keypass android \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=Piecework, OU=Android, O=MSadraShakouri, L=Warsaw, ST=Mazovia, C=PL"
```

Suggested values:

```text
Keystore file: piecework-debug.jks
Store password: android
Key alias: piecework
Key password: android
```

Using `android` as the password is common for debug APKs. Do **not** use this debug keystore for a Play Store release build.

## Convert the keystore to base64

GitHub Secrets can store text, not binary files. So convert the `.jks` file to base64.

### Linux

```bash
base64 -w 0 piecework-debug.jks > keystore.b64
```

### macOS

```bash
base64 -i piecework-debug.jks | tr -d '\n' > keystore.b64
```

### Windows PowerShell

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("piecework-debug.jks")) | Set-Content -NoNewline keystore.b64
```

Then open `keystore.b64` and copy the full single-line value.

## Add the GitHub secret

In the Piecework repository on GitHub:

1. Go to **Settings**.
2. Go to **Secrets and variables**.
3. Go to **Actions**.
4. Click **New repository secret**.
5. Add:

```text
Name: ANDROID_KEYSTORE_BASE64
Value: contents of keystore.b64
```

If using the lyrics-app-style debug setup with fixed passwords, you only need this one secret because the workflow hardcodes:

```text
storePassword: android
keyAlias: piecework
keyPassword: android
```

If using a release-signing setup, add separate password/alias secrets too:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

## Workflow snippet for a fixed debug APK

This is the part that matters for the debug APK update behavior.

After Capacitor creates the `android/` folder, decode the keystore:

```yaml
- name: Decode keystore
  run: |
    echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > android/app/keystore.jks
```

Then configure Gradle to sign the debug build with that keystore:

```yaml
- name: Configure Gradle to use fixed debug keystore
  run: |
    cat >> android/app/build.gradle << 'EOF'

    android {
        signingConfigs {
            debug {
                storeFile file('keystore.jks')
                storePassword 'android'
                keyAlias 'piecework'
                keyPassword 'android'
            }
        }
        buildTypes {
            debug {
                signingConfig signingConfigs.debug
            }
        }
    }
    EOF
```

Then build the debug APK:

```yaml
- name: Build Debug APK
  run: |
    cd android
    chmod +x gradlew
    ./gradlew assembleDebug --no-daemon
```

The APK output will be here:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

You can rename it:

```yaml
- name: Rename APK
  run: cp android/app/build/outputs/apk/debug/app-debug.apk piecework-debug.apk
```

## How to check the signing certificate fingerprint

This is probably the “hash” you remembered.

Run:

```bash
keytool -list -v \
  -keystore piecework-debug.jks \
  -alias piecework \
  -storepass android
```

Look for:

```text
SHA256: AA:BB:CC:...
```

That SHA256 fingerprint identifies the signing certificate.

Save it somewhere safe. It can be needed for Android integrations such as:

- Firebase
- Google sign-in
- Android App Links
- Play Console setup
- API key restrictions

## Important backup advice

Keep these files somewhere private and backed up:

```text
piecework-debug.jks
keystore.b64
```

If you lose the keystore, future APKs signed with a new keystore will **not** install as updates over APKs signed with the old one.

Your options then would be:

1. Uninstall the old app from the phone, then install the new APK.
2. Change the Android package id, which makes Android treat it as a different app.
3. Recover and reuse the original keystore.

## Debug APK vs release APK

### Debug APK

Best for:

- personal installs
- quick GitHub Actions artifacts
- testing on your own devices
- the same behavior you used in `lyric-sync`

Use:

```bash
./gradlew assembleDebug
```

Output:

```text
app-debug.apk
```

### Release APK

Best for:

- public distribution
- GitHub Releases
- long-term app identity
- possible Play Store/App Bundle work later

Use:

```bash
./gradlew assembleRelease
```

Output:

```text
app-release.apk
```

For release signing, do not hardcode passwords in the workflow. Use these GitHub Secrets:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

## Recommendation for Piecework

Since you specifically remember the `lyric-sync` debug APK behavior and want updates to install over the same app, use this setup:

```text
Package id: com.msadrashakouri.piecework
Keystore file: piecework-debug.jks
Alias: piecework
Store password: android
Key password: android
GitHub secret: ANDROID_KEYSTORE_BASE64
Build type: debug
Output name: piecework-debug.apk
```

As long as you keep using the same `ANDROID_KEYSTORE_BASE64`, every new debug APK from GitHub Actions should install over the previous Piecework APK on your device.
