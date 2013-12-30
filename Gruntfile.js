'use strict';

module.exports = function(grunt) {
    // load all installed grunt tasks
    require('load-grunt-tasks')(grunt);

    grunt.file.readXML = function(filepath) {
        require('require-xml');
        return JSON.parse(require(filepath));
    };

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        widget: grunt.file.readXML('config.xml').widget,
        path: {
            dist: 'dist'
        },
        bower_postinst: {
            dist: {
                options: {
                    components: {
                        'jquery-mobile': ['npm', {'grunt': 'js'}, {'grunt': 'css'}]
                    }
                }
            }
        },
        clean: {
            dist: ['<%= path.dist %>/*']
        },
        useminPrepare: {
            html: '<%= path.dist %>/*.html',
            options: {
                dest: '<%= path.dist %>'
            }
        },
        usemin: {
            html: ['<%= path.dist %>/{,*/}*.html'],
            css: ['<%= path.dist %>/styles/{,*/}*.css'],
            options: {
                dirs: ['<%= path.dist %>']
            }
        },
        shell: {
            build: {
                options: {
                    stdout: true
                },
                command: 'web-build ./ -e "\.*" -e "node_modules*" -e "nbproject*" -e "Gruntfile.js" -e "package.json" -e "*signature*.xml" --output <%= path.dist %>/ ./'
            },
            sign: {
                options: {
                    stdout: true
                },
                command: 'cd <%= path.dist %> && web-signing -p <%= pkg.tizen.profile %> -n && cd ..'
            },
            package: {
                options: {
                    stdout: true
                },
                command: 'web-packaging -o -n <%= pkg.name %>.wgt <%= path.dist %>'
            }
        },
        watch: {
            files: [
                '**/*',
                '!<%= path.dist %>/**',
                '!node_modules/**',
                '!vendor/**'
            ],
            tasks: [],
        },
        tizen_configuration: {
            tizenAppScriptDir: '/opt/usr/apps/tmp'
        },
        tizen: {
            push: {
                action: 'push',
                localFiles: {
                    pattern: '<%= pkg.name %>.wgt'
                },
                remoteDir: '/opt/usr/apps/tmp'
            },
            install: {
                action: 'install',
                remoteFiles: {
                    pattern: '/opt/usr/apps/tmp/*.wgt',
                    filter: 'latest'
                }
            },
            start: {
                action: 'start',
                stopOnFailure: true
            },
            stop: {
                action: 'stop',
                stopOnFailure: false
            },
            debug: {
                action: 'debug',
                browserCmd: 'chromium-browser',
                localPort: 9090,
                stopOnFailure: true
            }
        }
    });

    /**
     * Handle watch event - remove/push file to emulator
     */
    grunt.event.on('watch', function(action, filepath, target) {
        var packageId = grunt.config.get('widget')['tizen:application'].package;

        grunt.util.spawn({
            cmd: 'sdb',
            args: ['-e', 'root',  'on']
        }, function(error, result, code) {
            if (code !== 0) {
                grunt.fatal(result.stderr, 1);
            }

            var remotePath = '/opt/usr/apps/' + packageId + '/res/wgt/' + filepath;
            var args = ['-e'];
            switch (action) {
                case 'added':
                case 'changed':
                    args.push('push', filepath, remotePath);
                    break;
                case 'deleted':
                    args.push('shell', 'rm', remotePath);
                    break;
            }
            grunt.util.spawn({
                cmd: 'sdb',
                args: args
            }, function(error, result, code) {
                if (code !== 0) {
                    grunt.fail.fatal(result.stderr);
                }

                grunt.util.spawn({
                    cmd: 'sdb',
                    args: []
                }, function(error, result, code) {});
            });
        });
    });

    grunt.registerTask(
        'build',
        'Prepare Tizen widget (optimized by default, run build:dev for development version)',
        function(target) {
            grunt.task.run(['clean', 'shell:build']);

            if (!target || target === 'dist') {
                grunt.task.run([
                    'useminPrepare',
                    'concat',
                    'uglify',
                    'cssmin',
                    'usemin'
                ]);
            }

            grunt.task.run([
                'shell:sign',
                'shell:package'
            ]);
        }
    );

    grunt.registerTask('install', [
        'tizen_prepare',
        'tizen:push',
        'tizen:install'
    ]);

    grunt.registerTask('run', [
        'install',
        'tizen:start'
    ]);
    grunt.registerTask('debug', [
        'install',
        'tizen:debug'
    ]);

    grunt.registerTask('default', [
        'build'
    ]);
};
