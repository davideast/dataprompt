{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [
    pkgs.nodejs_20
    pkgs.git
  ];
  env = { };
  idx = {
    extensions = [];
    previews = {
      enable = true;
      # previews = {
      #   web = {
      #     command = ["npm" "run" "dev"];
      #     manager = "web";
      #     env = { PORT = "$PORT"; };
      #   };
      # };
    };
    workspace = {
      onCreate = {};
      onStart = {};
    };
  };
}
