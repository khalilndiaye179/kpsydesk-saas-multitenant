#!/bin/bash
# build.sh - Compiler l'agent macOS dans un fichier .pkg

# S'assurer d'être dans le bon dossier
cd "$(dirname "$0")"

echo "=== Préparation de la structure de build ==="
rm -rf build_root KPsyITAgent_macOS.pkg
mkdir -p build_root/usr/local/bin
mkdir -p build_root/Library/LaunchDaemons
mkdir -p "build_root/Library/Application Support/KPsyITAgent"
mkdir -p build_scripts

# Copier les fichiers
cp kpsy-agent.sh build_root/usr/local/bin/
chmod +x build_root/usr/local/bin/kpsy-agent.sh

cp com.kpsy.agent.plist build_root/Library/LaunchDaemons/
cp config.json "build_root/Library/Application Support/KPsyITAgent/"

# Créer le script postinstall
cat << 'EOF' > build_scripts/postinstall
#!/bin/bash
chmod 644 /Library/LaunchDaemons/com.kpsy.agent.plist
chown root:wheel /Library/LaunchDaemons/com.kpsy.agent.plist
# Activer le daemon s'il n'est pas déjà chargé
launchctl load -w /Library/LaunchDaemons/com.kpsy.agent.plist 2>/dev/null || true
EOF
chmod +x build_scripts/postinstall

echo "=== Génération du fichier PKG ==="
pkgbuild --root build_root \
         --scripts build_scripts \
         --identifier com.kpsy.agent \
         --version 3.0.0 \
         --install-location / \
         KPsyITAgent_macOS.pkg

echo "=== Succès : KPsyITAgent_macOS.pkg créé ! ==="
# Nettoyer les fichiers de construction temporaires
rm -rf build_root build_scripts
