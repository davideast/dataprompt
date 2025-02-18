{ pkgs, ... }: {
  packages = [
    pkgs.nodejs_20
    pkgs.git
  ];
  bootstrap = ''
    mkdir "$out"
    mkdir "$out"/.idx
    cp ${./dev.nix} "$out/.idx/dev.nix"
    npm init -y
    npx dataprompt create "$out"
    # Set some permissions
    chmod -R +w "$out"
    git init "$out"
  '';
}
