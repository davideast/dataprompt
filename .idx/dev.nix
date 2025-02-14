{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [
    pkgs.nodejs_20
  ];
  env = {
    GOOGLEAI_API_KEY="";
    GOOGLE_APPLICATION_CREDENTIALS="/path/to/sa.json";
   };
  idx = {
    internal.templates-cli.enable = true;
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
