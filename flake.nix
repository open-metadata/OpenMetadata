{
  description = "A nix flake containing the full Open-Metadata dev stack except python";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-24.05";
  };

  outputs = { self, nixpkgs }: 
    let
        system = "x86_64-linux";
        pkgs = nixpkgs.legacyPackages.${system};
    in 
    with pkgs;
    {
        devShell = {
            x86_64-linux = pkgs.mkShell {
              buildInputs = [ 
                pkgs.starship
                pkgs.fish
                pkgs.yarn 
                pkgs.jdk17
                pkgs.nodejs_18
                pkgs.docker
                pkgs.maven
                pkgs.antlr4_9
                pkgs.jq
              ];
            shellHook = ''
                if [ -n "$PS1" ]; then
                    exec fish
                fi
            '';
            };
        };
    };
}
