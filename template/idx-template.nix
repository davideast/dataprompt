{ pkgs, ... }: {
  packages = [
    pkgs.nodejs_20
  ];
  bootstrap = ''
    mkdir "$out"
    cp ${./dev.nix} "$out/dev.nix"
    npm init -y
    npx dataprompt create "$out"
    # Set some permissions
    chmod -R +w "$out"
  '';
}